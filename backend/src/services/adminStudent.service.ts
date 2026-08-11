import { prisma } from '../config/database';
import { isStudentOnline } from '../socket';
import { RoundStatus, RoundProgressStatus, QuestionType } from '@prisma/client';

export interface StudentListQueryOptions {
  search?: string;
  statusFilter?: string;
  roundId?: string;
  batchNumber?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class AdminStudentService {
  /**
   * Retrieves paginated students list with online status, round progress, activity state, scores, and global counters.
   */
  public async getStudentsList(options: StudentListQueryOptions) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 25));
    const skip = (page - 1) * limit;

    const search = options.search?.trim();
    const statusFilter = options.statusFilter || 'ALL';
    const roundIdFilter = options.roundId;
    const batchFilter = options.batchNumber;

    // Fetch primary active/live round if any
    const activeRound = await prisma.round.findFirst({
      where: { isEnabled: true, status: { in: [RoundStatus.LIVE, RoundStatus.PAUSED] } },
      orderBy: { order: 'asc' },
    });

    const allEnabledRounds = await prisma.round.findMany({
      where: { isEnabled: true },
      orderBy: { order: 'asc' },
    });

    // Build base Prisma WHERE clause
    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
        { batchNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (batchFilter) {
      where.batchNumber = batchFilter;
    }

    // Fetch matching students from DB with necessary relations
    const allMatchingStudents = await prisma.student.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true } },
        progresses: {
          include: { round: { select: { id: true, name: true, type: true, order: true } } },
        },
        scores: {
          select: { roundId: true, score: true, maximumScore: true },
        },
        violations: {
          select: { id: true, type: true, timestamp: true },
        },
        finalScore: { select: { totalScore: true, rank: true } },
      },
      orderBy:
        options.sortBy === 'fullName'
          ? { fullName: options.sortOrder || 'asc' }
          : options.sortBy === 'batchNumber'
          ? { batchNumber: options.sortOrder || 'asc' }
          : { studentId: options.sortOrder || 'asc' },
    });

    // Decorate students with real-time status & metrics
    const decoratedStudents = allMatchingStudents.map((s) => {
      const online = isStudentOnline(s.studentId);
      const violationCount = s.violations.length;

      // Determine progress in active round or current round
      const activeProgress = activeRound
        ? s.progresses.find((p) => p.roundId === activeRound.id)
        : s.progresses.slice().sort((a, b) => (b.round?.order || 0) - (a.round?.order || 0))[0];

      const isLocked = activeProgress?.status === RoundProgressStatus.LOCKED || violationCount >= 3;

      let activityStatus = 'WAITING';
      if (!online) {
        activityStatus = 'OFFLINE';
      } else if (isLocked) {
        activityStatus = 'LOCKED';
      } else if (activeProgress?.status === RoundProgressStatus.SUBMITTED) {
        activityStatus = 'SUBMITTED';
      } else if (activeProgress?.status === RoundProgressStatus.IN_PROGRESS) {
        activityStatus = activeRound?.status === RoundStatus.PAUSED ? 'PAUSED' : 'WORKING';
      } else if (allEnabledRounds.length > 0 && s.progresses.filter((p) => p.status === RoundProgressStatus.SUBMITTED).length === allEnabledRounds.length) {
        activityStatus = 'COMPLETED';
      }

      // Calculate total score from RoundScores if FinalScore not calculated yet
      const totalScoreCalculated = s.finalScore?.totalScore ?? s.scores.reduce((acc, sc) => acc + (sc.score || 0), 0);

      // Latest activity timestamp
      const lastSavedDates = s.progresses.map((p) => p.lastSavedAt?.getTime() || p.submittedAt?.getTime() || 0).filter(Boolean);
      const latestActivityMs = Math.max(s.updatedAt.getTime(), ...lastSavedDates, 0);

      return {
        id: s.id,
        userId: s.userId,
        studentId: s.studentId,
        fullName: s.fullName,
        batchNumber: s.batchNumber,
        accountActive: s.user.isActive,
        isOnline: online,
        activityStatus,
        isLocked,
        violationCount,
        totalScore: totalScoreCalculated,
        rank: s.finalScore?.rank || null,
        currentRound: activeProgress?.round
          ? {
              id: activeProgress.round.id,
              name: activeProgress.round.name,
              type: activeProgress.round.type,
              status: activeProgress.status,
            }
          : activeRound
          ? { id: activeRound.id, name: activeRound.name, type: activeRound.type, status: 'NOT_STARTED' }
          : null,
        lastActivityAt: new Date(latestActivityMs).toISOString(),
        submissionAt: activeProgress?.submittedAt ? activeProgress.submittedAt.toISOString() : null,
      };
    });

    // Apply status filter in-memory for live calculated states (ONLINE, WORKING, LOCKED, etc.)
    let filteredStudents = decoratedStudents;
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ONLINE') filteredStudents = decoratedStudents.filter((s) => s.isOnline);
      else if (statusFilter === 'OFFLINE') filteredStudents = decoratedStudents.filter((s) => !s.isOnline);
      else if (statusFilter === 'WORKING') filteredStudents = decoratedStudents.filter((s) => s.activityStatus === 'WORKING');
      else if (statusFilter === 'SUBMITTED') filteredStudents = decoratedStudents.filter((s) => s.activityStatus === 'SUBMITTED');
      else if (statusFilter === 'LOCKED') filteredStudents = decoratedStudents.filter((s) => s.isLocked);
      else if (statusFilter === 'WITH_VIOLATIONS') filteredStudents = decoratedStudents.filter((s) => s.violationCount > 0);
      else if (statusFilter === 'COMPLETED') filteredStudents = decoratedStudents.filter((s) => s.activityStatus === 'COMPLETED');
      else if (statusFilter === 'WAITING') filteredStudents = decoratedStudents.filter((s) => s.activityStatus === 'WAITING');
    }

    if (roundIdFilter) {
      filteredStudents = filteredStudents.filter((s) => s.currentRound?.id === roundIdFilter);
    }

    // Secondary sorting if requested for dynamically computed fields
    if (options.sortBy === 'score') {
      filteredStudents.sort((a, b) => (options.sortOrder === 'asc' ? a.totalScore - b.totalScore : b.totalScore - a.totalScore));
    } else if (options.sortBy === 'violations') {
      filteredStudents.sort((a, b) => (options.sortOrder === 'asc' ? a.violationCount - b.violationCount : b.violationCount - a.violationCount));
    } else if (options.sortBy === 'online') {
      filteredStudents.sort((a, b) => (options.sortOrder === 'asc' ? Number(a.isOnline) - Number(b.isOnline) : Number(b.isOnline) - Number(a.isOnline)));
    }

    const totalCount = filteredStudents.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginatedStudents = filteredStudents.slice(skip, skip + limit);

    // Global summary metrics counters across all students in database
    const totalStudents = await prisma.student.count();
    const onlineCount = decoratedStudents.filter((s) => s.isOnline).length;
    const offlineCount = Math.max(0, totalStudents - onlineCount);
    const workingCount = decoratedStudents.filter((s) => s.activityStatus === 'WORKING').length;
    const submittedCount = decoratedStudents.filter((s) => s.activityStatus === 'SUBMITTED').length;
    const lockedCount = decoratedStudents.filter((s) => s.isLocked).length;
    const withViolationsCount = decoratedStudents.filter((s) => s.violationCount > 0).length;

    return {
      students: paginatedStudents,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages,
      },
      summary: {
        totalStudents,
        onlineCount,
        offlineCount,
        workingCount,
        submittedCount,
        lockedCount,
        withViolationsCount,
      },
    };
  }

  /**
   * Retrieves full detailed inspection payload for a single student.
   * STRICT SECURITY: Never returns password hashes, JWT tokens, or internal security credentials!
   */
  public async getStudentDetail(studentIdOrDbId: string) {
    const student = await prisma.student.findFirst({
      where: {
        OR: [{ id: studentIdOrDbId }, { studentId: studentIdOrDbId }],
      },
      include: {
        user: { select: { id: true, email: true, username: true, isActive: true, createdAt: true } },
        progresses: {
          include: { round: true },
        },
        scores: {
          include: { round: true },
        },
        violations: {
          include: { round: { select: { name: true, type: true } } },
          orderBy: { timestamp: 'desc' },
        },
        finalScore: true,
        answers: {
          include: {
            question: {
              include: { options: { orderBy: { order: 'asc' } } },
            },
          },
        },
        debuggingSubmissions: {
          include: { problem: true },
          orderBy: { submittedAt: 'desc' },
        },
        programmingSubmissions: {
          include: { problem: true },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    const online = isStudentOnline(student.studentId);
    const event = await prisma.event.findFirst({ include: { settings: true } });
    const maximumAllowedViolations = event?.settings?.maximumViolations ?? 3;

    // Build Round 1 Inspection Details
    const round1Progress = student.progresses.find((p) => p.round?.type === 'MCQ');
    const round1Score = student.scores.find((s) => s.round?.type === 'MCQ');
    const round1Questions = round1Progress?.roundId
      ? await prisma.question.findMany({
          where: { roundId: round1Progress.roundId, isActive: true },
          include: { options: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        })
      : [];

    const round1Inspection = {
      status: round1Progress?.status || 'NOT_STARTED',
      score: round1Score?.score ?? 0,
      maximumScore: round1Score?.maximumScore ?? 0,
      submittedAt: round1Progress?.submittedAt ? round1Progress.submittedAt.toISOString() : null,
      totalQuestions: round1Questions.length,
      answeredCount: student.answers.length,
      answers: round1Questions.map((q) => {
        const studentAns = student.answers.find((a) => a.questionId === q.id);
        const isCorrect =
          q.questionType === QuestionType.MCQ
            ? studentAns?.answer === q.correctAnswer
            : (studentAns?.answer || '').trim().toLowerCase() === (q.correctOutput || '').trim().toLowerCase();

        return {
          questionId: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          code: q.code,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          studentAnswer: studentAns?.answer || '(Unanswered)',
          correctAnswer: q.correctAnswer || q.correctOutput || 'N/A',
          options: q.options,
          isCorrect,
          answeredAt: studentAns?.updatedAt ? studentAns.updatedAt.toISOString() : null,
        };
      }),
    };

    // Build Round 2 Inspection Details (Bug Hunt)
    const round2Progress = student.progresses.find((p) => p.round?.type === 'DEBUGGING');
    const round2Score = student.scores.find((s) => s.round?.type === 'DEBUGGING');
    const currentCodeDraftR2 = (round2Progress?.stateData as any)?.code || null;

    const round2Inspection = {
      status: round2Progress?.status || 'NOT_STARTED',
      score: round2Score?.score ?? 0,
      maximumScore: round2Score?.maximumScore ?? 0,
      currentDraftCode: currentCodeDraftR2,
      lastSavedAt: round2Progress?.lastSavedAt ? round2Progress.lastSavedAt.toISOString() : null,
      submissions: student.debuggingSubmissions.map((sub, index) => ({
        submissionIndex: student.debuggingSubmissions.length - index,
        id: sub.id,
        problemTitle: sub.problem.title,
        submittedCode: sub.submittedCode,
        compileStatus: sub.compileStatus,
        compileOutput: sub.compileOutput,
        executionOutput: sub.executionOutput,
        awardedMarks: sub.score,
        timestamp: sub.submittedAt.toISOString(),
      })),
    };

    // Build Round 3 Inspection Details (Programming)
    const round3Progress = student.progresses.find((p) => p.round?.type === 'PROGRAMMING');
    const round3Score = student.scores.find((s) => s.round?.type === 'PROGRAMMING');
    const currentCodeDraftsR3 = (round3Progress?.stateData as any)?.savedCodeMap || {};

    const round3Inspection = {
      status: round3Progress?.status || 'NOT_STARTED',
      score: round3Score?.score ?? 0,
      maximumScore: round3Score?.maximumScore ?? 0,
      savedCodeMap: currentCodeDraftsR3,
      lastSavedAt: round3Progress?.lastSavedAt ? round3Progress.lastSavedAt.toISOString() : null,
      submissions: student.programmingSubmissions.map((sub, index) => ({
        submissionIndex: student.programmingSubmissions.length - index,
        id: sub.id,
        problemTitle: sub.problem.title,
        language: sub.language,
        submittedCode: sub.submittedCode,
        compileStatus: sub.compileStatus,
        compileOutput: sub.compileOutput,
        passedTestsCount: sub.passedTests,
        totalTestsCount: sub.totalTests,
        executionTimeMs: sub.executionTime || 0,
        score: sub.score,
        status: sub.submissionStatus,
        timestamp: sub.submittedAt.toISOString(),
      })),
    };

    // Audit logs history
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: student.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      studentInfo: {
        id: student.id,
        studentId: student.studentId,
        fullName: student.fullName,
        batchNumber: student.batchNumber,
        email: student.user.email,
        username: student.user.username,
        accountActive: student.user.isActive,
        createdAt: student.createdAt.toISOString(),
        isOnline: online,
      },
      overall: {
        totalScore: student.finalScore?.totalScore ?? (round1Inspection.score + round2Inspection.score + round3Inspection.score),
        rank: student.finalScore?.rank || null,
        violationCount: student.violations.length,
        maximumAllowedViolations,
        isLocked: student.progresses.some((p) => p.status === RoundProgressStatus.LOCKED) || student.violations.length >= maximumAllowedViolations,
      },
      round1: round1Inspection,
      round2: round2Inspection,
      round3: round3Inspection,
      violations: student.violations.map((v) => ({
        id: v.id,
        type: v.type,
        details: v.details,
        roundName: v.round.name,
        timestamp: v.timestamp.toISOString(),
      })),
      activityLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        metadata: log.metadata,
        timestamp: log.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Toggles student user account active/suspended status.
   */
  public async toggleStudentAccount(studentIdOrDbId: string, isActive: boolean, adminUserId?: string) {
    const student = await prisma.student.findFirst({
      where: { OR: [{ id: studentIdOrDbId }, { studentId: studentIdOrDbId }] },
    });

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    await prisma.user.update({
      where: { id: student.userId },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        action: isActive ? 'ADMIN_ENABLED_STUDENT' : 'ADMIN_DISABLED_STUDENT',
        entity: 'Student',
        entityId: student.id,
        userId: adminUserId || student.userId,
        metadata: { studentId: student.studentId, isActive },
      },
    });

    return {
      status: 'success',
      studentId: student.studentId,
      accountActive: isActive,
    };
  }
}

export const adminStudentService = new AdminStudentService();
