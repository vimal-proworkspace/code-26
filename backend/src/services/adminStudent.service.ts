import { query, queryOne, execute } from '../config/database';
import { isStudentOnline } from '../socket';
import { RoundStatus, RoundProgressStatus, QuestionType, DbStudent, DbRound, DbRoundProgress, DbQuestion, DbStudentAnswer, DbQuestionOption, DbDebuggingSubmission, DbProgrammingSubmission, DbViolation, DbAuditLog } from '../config/types';

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
    const activeRound = await queryOne<DbRound>(
      `SELECT * FROM rounds WHERE "isEnabled" = true AND status IN ('LIVE', 'PAUSED') ORDER BY "order" ASC LIMIT 1`
    );

    const allEnabledRounds = await query<DbRound>(
      `SELECT * FROM rounds WHERE "isEnabled" = true ORDER BY "order" ASC`
    );

    // Build SQL WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`("fullName" ILIKE $${idx} OR "studentId" ILIKE $${idx} OR "batchNumber" ILIKE $${idx})`);
    }

    if (batchFilter) {
      params.push(batchFilter);
      conditions.push(`"batchNumber" = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Order clause
    let orderByClause = `ORDER BY "studentId" ASC`;
    if (options.sortBy === 'fullName') {
      orderByClause = `ORDER BY "fullName" ${options.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    } else if (options.sortBy === 'batchNumber') {
      orderByClause = `ORDER BY "batchNumber" ${options.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    } else if (options.sortBy === 'studentId') {
      orderByClause = `ORDER BY "studentId" ${options.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    const students = await query<DbStudent & { user_email: string; user_username: string; user_isActive: boolean }>(
      `SELECT s.*, u.email as user_email, u.username as user_username, u."isActive" as "user_isActive"
       FROM students s
       JOIN users u ON u.id = s."userId"
       ${whereClause}
       ${orderByClause}`,
      params
    );

    // Decorate students with real-time status & metrics
    const decoratedStudents = await Promise.all(
      students.map(async (s) => {
        const online = isStudentOnline(s.studentId);

        // Fetch student violations
        const violations = await query<DbViolation>(
          `SELECT id, type, timestamp FROM violations WHERE "studentId" = $1`,
          [s.id]
        );
        const violationCount = violations.length;

        // Fetch student progress
        const progresses = await query<DbRoundProgress & { round_order: number; round_name: string; round_type: string }>(
          `SELECT rp.*, r.order as round_order, r.name as round_name, r.type as round_type
           FROM round_progress rp
           JOIN rounds r ON r.id = rp."roundId"
           WHERE rp."studentId" = $1`,
          [s.id]
        );

        // Fetch student scores
        const scores = await query<{ roundId: string; score: number; maximumScore: number }>(
          `SELECT "roundId", score, "maximumScore" FROM round_scores WHERE "studentId" = $1`,
          [s.id]
        );

        // Fetch final score
        const finalScore = await queryOne<{ totalScore: number; rank: number | null }>(
          `SELECT "totalScore", rank FROM final_scores WHERE "studentId" = $1`,
          [s.id]
        );

        const activeProgress = activeRound
          ? progresses.find((p) => p.roundId === activeRound.id)
          : progresses.slice().sort((a, b) => b.round_order - a.round_order)[0];

        const isLocked = activeProgress?.status === 'LOCKED' || violationCount >= 3;

        let activityStatus = 'WAITING';
        if (!online) {
          activityStatus = 'OFFLINE';
        } else if (isLocked) {
          activityStatus = 'LOCKED';
        } else if (activeProgress?.status === 'SUBMITTED') {
          activityStatus = 'SUBMITTED';
        } else if (activeProgress?.status === 'IN_PROGRESS') {
          activityStatus = activeRound?.status === 'PAUSED' ? 'PAUSED' : 'WORKING';
        } else if (allEnabledRounds.length > 0 && progresses.filter((p) => p.status === 'SUBMITTED').length === allEnabledRounds.length) {
          activityStatus = 'COMPLETED';
        }

        const totalScoreCalculated = finalScore?.totalScore ?? scores.reduce((acc, sc) => acc + (sc.score || 0), 0);

        const lastSavedDates = progresses.map((p) => (p.lastSavedAt ? new Date(p.lastSavedAt).getTime() : p.submittedAt ? new Date(p.submittedAt).getTime() : 0)).filter(Boolean);
        const latestActivityMs = Math.max(new Date(s.updatedAt).getTime(), ...lastSavedDates, 0);

        return {
          id: s.id,
          userId: s.userId,
          studentId: s.studentId,
          fullName: s.fullName,
          batchNumber: s.batchNumber,
          accountActive: s.user_isActive,
          isOnline: online,
          activityStatus,
          isLocked,
          violationCount,
          totalScore: totalScoreCalculated,
          rank: finalScore?.rank || null,
          currentRound: activeProgress?.roundId
            ? {
                id: activeProgress.roundId,
                name: activeProgress.round_name,
                type: activeProgress.round_type,
                status: activeProgress.status,
              }
            : activeRound
            ? { id: activeRound.id, name: activeRound.name, type: activeRound.type, status: 'NOT_STARTED' }
            : null,
          lastActivityAt: new Date(latestActivityMs).toISOString(),
          submissionAt: activeProgress?.submittedAt ? new Date(activeProgress.submittedAt).toISOString() : null,
        };
      })
    );

    // Apply status filter in-memory
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

    const totalStudentsCount = await queryOne<{ count: string }>(`SELECT COUNT(*) FROM students`);
    const totalStudents = parseInt(totalStudentsCount?.count || '0', 10);
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
    const student = await queryOne<DbStudent & { user_id: string; user_email: string; user_username: string; user_isActive: boolean; user_createdAt: Date }>(
      `SELECT s.*, u.id as user_id, u.email as user_email, u.username as user_username,
              u."isActive" as "user_isActive", u."createdAt" as "user_createdAt"
       FROM students s
       JOIN users u ON u.id = s."userId"
       WHERE s.id = $1 OR s."studentId" = $1`,
      [studentIdOrDbId]
    );

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    const online = isStudentOnline(student.studentId);
    const eventSettings = await queryOne<{ maximumViolations: number }>(
      `SELECT "maximumViolations" FROM event_settings LIMIT 1`
    );
    const maximumAllowedViolations = eventSettings?.maximumViolations ?? 3;

    // Fetch student data relations
    const progresses = await query<DbRoundProgress & { round_type: string; round_name: string }>(
      `SELECT rp.*, r.type as round_type, r.name as round_name FROM round_progress rp JOIN rounds r ON r.id = rp."roundId" WHERE rp."studentId" = $1`,
      [student.id]
    );

    const scores = await query<DbRoundScore & { round_type: string; round_name: string }>(
      `SELECT rs.*, r.type as round_type, r.name as round_name FROM round_scores rs JOIN rounds r ON r.id = rs."roundId" WHERE rs."studentId" = $1`,
      [student.id]
    );

    const violations = await query<DbViolation & { round_name: string; round_type: string }>(
      `SELECT v.*, r.name as round_name, r.type as round_type FROM violations v JOIN rounds r ON r.id = v."roundId" WHERE v."studentId" = $1 ORDER BY v.timestamp DESC`,
      [student.id]
    );

    const finalScore = await queryOne<{ totalScore: number; rank: number | null }>(
      `SELECT "totalScore", rank FROM final_scores WHERE "studentId" = $1`,
      [student.id]
    );

    const answers = await query<DbStudentAnswer & { question_text: string; question_type: string; question_marks: number; question_correctAnswer: string | null; question_correctOutput: string | null; question_code: string | null; question_negativeMarks: number }>(
      `SELECT sa.*, q."questionText" as question_text, q."questionType" as question_type,
              q.marks as question_marks, q."correctAnswer" as "question_correctAnswer",
              q."correctOutput" as "question_correctOutput", q.code as question_code,
              q."negativeMarks" as "question_negativeMarks"
       FROM student_answers sa
       JOIN questions q ON q.id = sa."questionId"
       WHERE sa."studentId" = $1`,
      [student.id]
    );

    const debuggingSubmissions = await query<DbDebuggingSubmission & { problem_title: string }>(
      `SELECT ds.*, dp.title as problem_title FROM debugging_submissions ds JOIN debugging_problems dp ON dp.id = ds."debuggingProblemId" WHERE ds."studentId" = $1 ORDER BY ds."submittedAt" DESC`,
      [student.id]
    );

    const programmingSubmissions = await query<DbProgrammingSubmission & { problem_title: string }>(
      `SELECT ps.*, pp.title as problem_title FROM programming_submissions ps JOIN programming_problems pp ON pp.id = ps."programmingProblemId" WHERE ps."studentId" = $1 ORDER BY ps."submittedAt" DESC`,
      [student.id]
    );

    // Build Round 1 Inspection
    const round1Progress = progresses.find((p) => p.round_type === 'MCQ');
    const round1Score = scores.find((s) => s.round_type === 'MCQ');
    const round1Questions = round1Progress?.roundId
      ? await query<DbQuestion>(`SELECT * FROM questions WHERE "roundId" = $1 AND "isActive" = true ORDER BY "order" ASC`, [round1Progress.roundId])
      : [];

    const round1Inspection = {
      status: round1Progress?.status || 'NOT_STARTED',
      score: round1Score?.score ?? 0,
      maximumScore: round1Score?.maximumScore ?? 0,
      submittedAt: round1Progress?.submittedAt ? new Date(round1Progress.submittedAt).toISOString() : null,
      totalQuestions: round1Questions.length,
      answeredCount: answers.length,
      answers: await Promise.all(
        round1Questions.map(async (q) => {
          const studentAns = answers.find((a) => a.questionId === q.id);
          const options = await query<DbQuestionOption>(`SELECT * FROM question_options WHERE "questionId" = $1 ORDER BY "order" ASC`, [q.id]);
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
            options,
            isCorrect,
            answeredAt: studentAns?.updatedAt ? new Date(studentAns.updatedAt).toISOString() : null,
          };
        })
      ),
    };

    // Build Round 2 Inspection
    const round2Progress = progresses.find((p) => p.round_type === 'DEBUGGING');
    const round2Score = scores.find((s) => s.round_type === 'DEBUGGING');
    const currentCodeDraftR2 = (round2Progress?.stateData as any)?.code || null;

    const round2Inspection = {
      status: round2Progress?.status || 'NOT_STARTED',
      score: round2Score?.score ?? 0,
      maximumScore: round2Score?.maximumScore ?? 0,
      currentDraftCode: currentCodeDraftR2,
      lastSavedAt: round2Progress?.lastSavedAt ? new Date(round2Progress.lastSavedAt).toISOString() : null,
      submissions: debuggingSubmissions.map((sub, index) => ({
        submissionIndex: debuggingSubmissions.length - index,
        id: sub.id,
        problemTitle: sub.problem_title,
        submittedCode: sub.submittedCode,
        compileStatus: sub.compileStatus,
        compileOutput: sub.compileOutput,
        executionOutput: sub.executionOutput,
        awardedMarks: sub.score,
        timestamp: new Date(sub.submittedAt).toISOString(),
      })),
    };

    // Build Round 3 Inspection
    const round3Progress = progresses.find((p) => p.round_type === 'PROGRAMMING');
    const round3Score = scores.find((s) => s.round_type === 'PROGRAMMING');
    const currentCodeDraftsR3 = (round3Progress?.stateData as any)?.savedCodeMap || {};

    const round3Inspection = {
      status: round3Progress?.status || 'NOT_STARTED',
      score: round3Score?.score ?? 0,
      maximumScore: round3Score?.maximumScore ?? 0,
      savedCodeMap: currentCodeDraftsR3,
      lastSavedAt: round3Progress?.lastSavedAt ? new Date(round3Progress.lastSavedAt).toISOString() : null,
      submissions: programmingSubmissions.map((sub, index) => ({
        submissionIndex: programmingSubmissions.length - index,
        id: sub.id,
        problemTitle: sub.problem_title,
        language: sub.language,
        submittedCode: sub.submittedCode,
        compileStatus: sub.compileStatus,
        compileOutput: sub.compileOutput,
        passedTestsCount: sub.passedTests,
        totalTestsCount: sub.totalTests,
        executionTimeMs: sub.executionTime || 0,
        score: sub.score,
        status: sub.submissionStatus,
        timestamp: new Date(sub.submittedAt).toISOString(),
      })),
    };

    const auditLogs = await query<DbAuditLog>(
      `SELECT * FROM audit_logs WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 50`,
      [student.userId]
    );

    return {
      studentInfo: {
        id: student.id,
        studentId: student.studentId,
        fullName: student.fullName,
        batchNumber: student.batchNumber,
        email: student.user_email,
        username: student.user_username,
        accountActive: student.user_isActive,
        createdAt: new Date(student.createdAt).toISOString(),
        isOnline: online,
      },
      overall: {
        totalScore: finalScore?.totalScore ?? (round1Inspection.score + round2Inspection.score + round3Inspection.score),
        rank: finalScore?.rank || null,
        violationCount: violations.length,
        maximumAllowedViolations,
        isLocked: progresses.some((p) => p.status === 'LOCKED') || violations.length >= maximumAllowedViolations,
      },
      round1: round1Inspection,
      round2: round2Inspection,
      round3: round3Inspection,
      violations: violations.map((v) => ({
        id: v.id,
        type: v.type,
        details: v.details,
        roundName: v.round_name,
        timestamp: new Date(v.timestamp).toISOString(),
      })),
      activityLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        metadata: log.metadata,
        timestamp: new Date(log.createdAt).toISOString(),
      })),
    };
  }

  /**
   * Toggles student user account active/suspended status.
   */
  public async toggleStudentAccount(studentIdOrDbId: string, isActive: boolean, adminUserId?: string) {
    const student = await queryOne<DbStudent>(
      `SELECT * FROM students WHERE id = $1 OR "studentId" = $1`,
      [studentIdOrDbId]
    );

    if (!student) {
      throw { statusCode: 404, message: 'Student record not found' };
    }

    await execute(
      `UPDATE users SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2`,
      [isActive, student.userId]
    );

    await query(
      `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, 'Student', $2, $3, $4, NOW())`,
      [
        isActive ? 'ADMIN_ENABLED_STUDENT' : 'ADMIN_DISABLED_STUDENT',
        student.id,
        adminUserId || student.userId,
        JSON.stringify({ studentId: student.studentId, isActive }),
      ]
    );

    return {
      status: 'success',
      studentId: student.studentId,
      accountActive: isActive,
    };
  }
}

export const adminStudentService = new AdminStudentService();
