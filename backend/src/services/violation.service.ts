import { prisma } from '../config/database';
import { ViolationType, RoundStatus, RoundProgressStatus } from '@prisma/client';
import { notifyAdminViolation } from '../socket';

export class ViolationService {
  /**
   * Helper to resolve active event ID.
   */
  private async getPrimaryEvent() {
    const event = await prisma.event.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { settings: true },
    });
    return event;
  }

  /**
   * Records a student violation during a LIVE round with deduplication and locking.
   */
  public async recordViolation(studentUserId: string, data: { violationType: ViolationType; details?: string }) {
    const student = await prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    const event = await this.getPrimaryEvent();
    if (!event) {
      throw { statusCode: 404, message: 'Event configuration not found' };
    }

    const maximumAllowed = event.settings?.maximumViolations ?? 3;

    // Determine current LIVE round
    const liveRound = await prisma.round.findFirst({
      where: {
        eventId: event.id,
        isEnabled: true,
        status: RoundStatus.LIVE,
      },
    });

    if (!liveRound) {
      // Monitoring is active strictly during LIVE rounds
      return {
        counted: false,
        message: 'Violation ignored: Anti-cheating monitoring is active only during LIVE rounds',
        violationCount: 0,
        maximumAllowed,
        isLocked: false,
      };
    }

    // Check for existing lock status in RoundProgress
    const progress = await prisma.roundProgress.findUnique({
      where: {
        studentId_roundId: {
          studentId: student.id,
          roundId: liveRound.id,
        },
      },
    });

    if (progress?.status === RoundProgressStatus.LOCKED) {
      const existingCount = await prisma.violation.count({
        where: { studentId: student.id, roundId: liveRound.id },
      });
      return {
        counted: false,
        message: 'Student is already locked',
        violationCount: existingCount,
        maximumAllowed,
        isLocked: true,
      };
    }

    // 2-Second Deduplication Window: Check if same violation type recorded in last 2 seconds
    const twoSecondsAgo = new Date(Date.now() - 2000);
    const recentDuplicate = await prisma.violation.findFirst({
      where: {
        studentId: student.id,
        roundId: liveRound.id,
        type: data.violationType,
        timestamp: { gte: twoSecondsAgo },
      },
    });

    if (recentDuplicate) {
      const existingCount = await prisma.violation.count({
        where: { studentId: student.id, roundId: liveRound.id },
      });
      return {
        counted: false,
        message: 'Duplicate violation event deduplicated within window',
        violationCount: existingCount,
        maximumAllowed,
        isLocked: existingCount >= maximumAllowed,
      };
    }

    // Persist new violation
    const newViolation = await prisma.violation.create({
      data: {
        studentId: student.id,
        roundId: liveRound.id,
        type: data.violationType,
        details: data.details || `Violation ${data.violationType} detected during LIVE round`,
      },
    });

    // Calculate current total violations for student in this round
    const totalCount = await prisma.violation.count({
      where: { studentId: student.id, roundId: liveRound.id },
    });

    const isLocked = totalCount >= maximumAllowed;

    if (isLocked) {
      await prisma.roundProgress.upsert({
        where: {
          studentId_roundId: {
            studentId: student.id,
            roundId: liveRound.id,
          },
        },
        create: {
          studentId: student.id,
          roundId: liveRound.id,
          status: RoundProgressStatus.LOCKED,
          lockedAt: new Date(),
        },
        update: {
          status: RoundProgressStatus.LOCKED,
          lockedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          action: 'STUDENT_LOCKED',
          entity: 'Student',
          entityId: student.id,
          userId: studentUserId,
          metadata: {
            studentId: student.studentId,
            roundId: liveRound.id,
            violationCount: totalCount,
            maximumAllowed,
          },
        },
      });
    }

    // Emit Socket.IO real-time notification to admin room
    notifyAdminViolation({
      studentId: student.studentId,
      studentName: student.fullName,
      violationType: data.violationType,
      count: totalCount,
      maximumAllowed,
    });

    await prisma.auditLog.create({
      data: {
        action: 'VIOLATION_RECORDED',
        entity: 'Violation',
        entityId: newViolation.id,
        userId: studentUserId,
        metadata: {
          studentId: student.studentId,
          type: data.violationType,
          count: totalCount,
          isLocked,
        },
      },
    });

    return {
      counted: true,
      violation: newViolation,
      violationCount: totalCount,
      maximumAllowed,
      isLocked,
    };
  }

  /**
   * Retrieves current violation & lock state for a student.
   */
  public async getStudentViolationState(studentUserId: string) {
    const student = await prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    const event = await this.getPrimaryEvent();
    const maximumAllowed = event?.settings?.maximumViolations ?? 3;

    // Active LIVE or PAUSED round
    const activeRound = await prisma.round.findFirst({
      where: {
        eventId: event?.id,
        isEnabled: true,
        status: { in: [RoundStatus.LIVE, RoundStatus.PAUSED] },
      },
    });

    if (!activeRound) {
      return {
        violationCount: 0,
        maximumAllowed,
        isLocked: false,
        activeRound: null,
      };
    }

    const violationCount = await prisma.violation.count({
      where: { studentId: student.id, roundId: activeRound.id },
    });

    const progress = await prisma.roundProgress.findUnique({
      where: {
        studentId_roundId: {
          studentId: student.id,
          roundId: activeRound.id,
        },
      },
    });

    const isLocked = progress?.status === RoundProgressStatus.LOCKED || violationCount >= maximumAllowed;

    return {
      violationCount,
      maximumAllowed,
      isLocked,
      activeRound: {
        id: activeRound.id,
        name: activeRound.name,
        status: activeRound.status,
      },
    };
  }

  /**
   * Validates invigilator continuation password and unlocks a locked student.
   * DOES NOT delete violations, DOES NOT modify round deadline, DOES NOT award extra time.
   */
  public async invigilatorUnlock(studentUserId: string, passwordInput: string, actorUserId?: string) {
    const expectedPassword = process.env.INVIGILATOR_PASSWORD || 'admin@sara';

    if (passwordInput !== expectedPassword) {
      throw { statusCode: 401, message: 'Invalid invigilator continuation password' };
    }

    const student = await prisma.student.findUnique({
      where: { userId: studentUserId },
    });

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    const event = await this.getPrimaryEvent();
    const activeRound = await prisma.round.findFirst({
      where: {
        eventId: event?.id,
        isEnabled: true,
        status: { in: [RoundStatus.LIVE, RoundStatus.PAUSED] },
      },
    });

    if (!activeRound) {
      throw { statusCode: 400, message: 'No active LIVE or PAUSED round to unlock' };
    }

    if (activeRound.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: 'Cannot unlock student when round is not LIVE' };
    }

    await prisma.roundProgress.upsert({
      where: {
        studentId_roundId: {
          studentId: student.id,
          roundId: activeRound.id,
        },
      },
      create: {
        studentId: student.id,
        roundId: activeRound.id,
        status: RoundProgressStatus.IN_PROGRESS,
      },
      update: {
        status: RoundProgressStatus.IN_PROGRESS,
        lockedAt: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'INVIGILATOR_UNLOCKED',
        entity: 'Student',
        entityId: student.id,
        userId: actorUserId || studentUserId,
        metadata: {
          studentId: student.studentId,
          roundId: activeRound.id,
          unlockedAt: new Date(),
        },
      },
    });

    return {
      success: true,
      message: 'Student competition access restored by invigilator.',
    };
  }

  /**
   * Admin overview of all violations and locked students.
   */
  public async getAdminViolationOverview() {
    const event = await this.getPrimaryEvent();
    const maximumAllowed = event?.settings?.maximumViolations ?? 3;

    const violations = await prisma.violation.findMany({
      include: {
        student: {
          select: { id: true, studentId: true, fullName: true, batchNumber: true },
        },
        round: {
          select: { id: true, name: true, type: true, order: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    const lockedProgresses = await prisma.roundProgress.findMany({
      where: { status: RoundProgressStatus.LOCKED },
      include: {
        student: {
          select: { id: true, studentId: true, fullName: true, batchNumber: true },
        },
        round: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return {
      maximumAllowed,
      totalViolations: violations.length,
      lockedCount: lockedProgresses.length,
      lockedStudents: lockedProgresses.map((p) => ({
        studentDbId: p.student.id,
        studentId: p.student.studentId,
        fullName: p.student.fullName,
        batchNumber: p.student.batchNumber,
        roundName: p.round.name,
        lockedAt: p.lockedAt,
      })),
      recentViolations: violations.map((v) => ({
        id: v.id,
        studentId: v.student.studentId,
        studentName: v.student.fullName,
        batchNumber: v.student.batchNumber,
        roundName: v.round.name,
        type: v.type,
        details: v.details,
        timestamp: v.timestamp,
      })),
    };
  }
}

export const violationService = new ViolationService();
