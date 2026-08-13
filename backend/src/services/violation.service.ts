import { query, queryOne, transaction, txQuery, txQueryOne, txExecute } from '../config/database';
import { ViolationType, RoundStatus, RoundProgressStatus, DbStudent, DbEvent, DbRound, DbRoundProgress, DbViolation, DbEventSettings } from '../config/types';
import { notifyAdminViolation } from '../socket';

export class ViolationService {
  private async getPrimaryEvent() {
    const event = await queryOne<DbEvent>(
      `SELECT * FROM events ORDER BY "createdAt" ASC LIMIT 1`
    );
    if (!event) return null;

    const settings = await queryOne<DbEventSettings>(
      `SELECT * FROM event_settings WHERE "eventId" = $1`,
      [event.id]
    );

    return { ...event, settings };
  }

  public async recordViolation(studentUserId: string, data: { violationType: ViolationType; details?: string }) {
    const student = await queryOne<DbStudent>(
      `SELECT * FROM students WHERE "userId" = $1`,
      [studentUserId]
    );

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    const event = await this.getPrimaryEvent();
    if (!event) {
      throw { statusCode: 404, message: 'Event configuration not found' };
    }

    const maximumAllowed = event.settings?.maximumViolations ?? 3;

    const liveRound = await queryOne<DbRound>(
      `SELECT * FROM rounds WHERE "eventId" = $1 AND "isEnabled" = true AND status = 'LIVE' LIMIT 1`,
      [event.id]
    );

    if (!liveRound) {
      return {
        counted: false,
        message: 'Violation ignored: Anti-cheating monitoring is active only during LIVE rounds',
        violationCount: 0,
        maximumAllowed,
        isLocked: false,
      };
    }

    const progress = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [student.id, liveRound.id]
    );

    if (progress?.status === 'LOCKED') {
      const countRes = await queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM violations WHERE "studentId" = $1 AND "roundId" = $2`,
        [student.id, liveRound.id]
      );
      const existingCount = parseInt(countRes?.count || '0', 10);
      return {
        counted: false,
        message: 'Student is already locked',
        violationCount: existingCount,
        maximumAllowed,
        isLocked: true,
      };
    }

    const twoSecondsAgo = new Date(Date.now() - 2000);
    const recentDuplicate = await queryOne<DbViolation>(
      `SELECT * FROM violations
       WHERE "studentId" = $1 AND "roundId" = $2 AND type = $3 AND timestamp >= $4
       LIMIT 1`,
      [student.id, liveRound.id, data.violationType, twoSecondsAgo]
    );

    if (recentDuplicate) {
      const countRes = await queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM violations WHERE "studentId" = $1 AND "roundId" = $2`,
        [student.id, liveRound.id]
      );
      const existingCount = parseInt(countRes?.count || '0', 10);
      return {
        counted: false,
        message: 'Duplicate violation event deduplicated within window',
        violationCount: existingCount,
        maximumAllowed,
        isLocked: existingCount >= maximumAllowed,
      };
    }

    const newViolation = await queryOne<DbViolation>(
      `INSERT INTO violations (id, "studentId", "roundId", type, details, timestamp)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
       RETURNING *`,
      [student.id, liveRound.id, data.violationType, data.details || `Violation ${data.violationType} detected during LIVE round`]
    );

    const totalCountRes = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM violations WHERE "studentId" = $1 AND "roundId" = $2`,
      [student.id, liveRound.id]
    );
    const totalCount = parseInt(totalCountRes?.count || '0', 10);
    const isLocked = totalCount >= maximumAllowed;

    if (isLocked) {
      await query(
        `INSERT INTO round_progress (id, "studentId", "roundId", status, "lockedAt")
         VALUES (gen_random_uuid(), $1, $2, 'LOCKED', NOW())
         ON CONFLICT ("studentId", "roundId")
         DO UPDATE SET status = 'LOCKED', "lockedAt" = NOW()`,
        [student.id, liveRound.id]
      );

      await query(
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'STUDENT_LOCKED', 'Student', $1, $2, $3, NOW())`,
        [
          student.id,
          studentUserId,
          JSON.stringify({
            studentId: student.studentId,
            roundId: liveRound.id,
            violationCount: totalCount,
            maximumAllowed,
          }),
        ]
      );
    }

    notifyAdminViolation({
      studentId: student.studentId,
      studentName: student.fullName,
      violationType: data.violationType,
      count: totalCount,
      maximumAllowed,
    });

    await query(
      `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
       VALUES (gen_random_uuid(), 'VIOLATION_RECORDED', 'Violation', $1, $2, $3, NOW())`,
      [
        newViolation!.id,
        studentUserId,
        JSON.stringify({
          studentId: student.studentId,
          type: data.violationType,
          count: totalCount,
          isLocked,
        }),
      ]
    );

    return {
      counted: true,
      violation: newViolation,
      violationCount: totalCount,
      maximumAllowed,
      isLocked,
    };
  }

  public async getStudentViolationState(studentUserId: string) {
    const student = await queryOne<DbStudent>(
      `SELECT * FROM students WHERE "userId" = $1`,
      [studentUserId]
    );

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    const event = await this.getPrimaryEvent();
    const maximumAllowed = event?.settings?.maximumViolations ?? 3;

    const activeRound = await queryOne<DbRound>(
      `SELECT * FROM rounds WHERE "eventId" = $1 AND "isEnabled" = true AND status IN ('LIVE', 'PAUSED') LIMIT 1`,
      [event?.id]
    );

    if (!activeRound) {
      return {
        violationCount: 0,
        maximumAllowed,
        isLocked: false,
        activeRound: null,
      };
    }

    const countRes = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM violations WHERE "studentId" = $1 AND "roundId" = $2`,
      [student.id, activeRound.id]
    );
    const violationCount = parseInt(countRes?.count || '0', 10);

    const progress = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [student.id, activeRound.id]
    );

    const isLocked = progress?.status === 'LOCKED' || violationCount >= maximumAllowed;

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

  public async invigilatorUnlock(studentUserId: string, passwordInput: string, actorUserId?: string) {
    const expectedPassword = process.env.INVIGILATOR_PASSWORD || 'admin@sara';

    if (passwordInput !== expectedPassword) {
      throw { statusCode: 401, message: 'Invalid invigilator continuation password' };
    }

    const student = await queryOne<DbStudent>(
      `SELECT * FROM students WHERE "userId" = $1`,
      [studentUserId]
    );

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    const event = await this.getPrimaryEvent();
    const activeRound = await queryOne<DbRound>(
      `SELECT * FROM rounds WHERE "eventId" = $1 AND "isEnabled" = true AND status IN ('LIVE', 'PAUSED') LIMIT 1`,
      [event?.id]
    );

    if (!activeRound) {
      throw { statusCode: 400, message: 'No active LIVE or PAUSED round to unlock' };
    }

    if (activeRound.status !== 'LIVE') {
      throw { statusCode: 400, message: 'Cannot unlock student when round is not LIVE' };
    }

    await query(
      `INSERT INTO round_progress (id, "studentId", "roundId", status)
       VALUES (gen_random_uuid(), $1, $2, 'IN_PROGRESS')
       ON CONFLICT ("studentId", "roundId")
       DO UPDATE SET status = 'IN_PROGRESS', "lockedAt" = NULL`,
      [student.id, activeRound.id]
    );

    await query(
      `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
       VALUES (gen_random_uuid(), 'INVIGILATOR_UNLOCKED', 'Student', $1, $2, $3, NOW())`,
      [
        student.id,
        actorUserId || studentUserId,
        JSON.stringify({
          studentId: student.studentId,
          roundId: activeRound.id,
          unlockedAt: new Date(),
        }),
      ]
    );

    return {
      success: true,
      message: 'Student competition access restored by invigilator.',
    };
  }

  public async getAdminViolationOverview() {
    const event = await this.getPrimaryEvent();
    const maximumAllowed = event?.settings?.maximumViolations ?? 3;

    const violations = await query<DbViolation & { student_studentId: string; student_fullName: string; student_batchNumber: string; round_name: string; round_type: string; round_order: number }>(
      `SELECT v.*, s."studentId" as "student_studentId", s."fullName" as "student_fullName", s."batchNumber" as "student_batchNumber",
              r.name as round_name, r.type as round_type, r.order as round_order
       FROM violations v
       JOIN students s ON s.id = v."studentId"
       JOIN rounds r ON r.id = v."roundId"
       ORDER BY v.timestamp DESC
       LIMIT 100`
    );

    const lockedProgresses = await query<DbRoundProgress & { student_id: string; student_studentId: string; student_fullName: string; student_batchNumber: string; round_name: string; round_type: string }>(
      `SELECT rp.*, s.id as student_id, s."studentId" as "student_studentId", s."fullName" as "student_fullName", s."batchNumber" as "student_batchNumber",
              r.name as round_name, r.type as round_type
       FROM round_progress rp
       JOIN students s ON s.id = rp."studentId"
       JOIN rounds r ON r.id = rp."roundId"
       WHERE rp.status = 'LOCKED'`
    );

    return {
      maximumAllowed,
      totalViolations: violations.length,
      lockedCount: lockedProgresses.length,
      lockedStudents: lockedProgresses.map((p) => ({
        studentDbId: p.student_id,
        studentId: p.student_studentId,
        fullName: p.student_fullName,
        batchNumber: p.student_batchNumber,
        roundName: p.round_name,
        lockedAt: p.lockedAt,
      })),
      recentViolations: violations.map((v) => ({
        id: v.id,
        studentId: v.student_studentId,
        studentName: v.student_fullName,
        batchNumber: v.student_batchNumber,
        roundName: v.round_name,
        type: v.type,
        details: v.details,
        timestamp: v.timestamp,
      })),
    };
  }
}

export const violationService = new ViolationService();
