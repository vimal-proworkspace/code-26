import { query, queryOne, transaction, txQuery, txQueryOne, txExecute } from '../config/database';
import { RoundType, DbEvent, DbRound, DbStudent, DbFinalScore, DbVisibilitySettings, DbRoundScore, DbProgrammingSubmission, DbDebuggingSubmission, DbStudentAnswer, DbRoundProgress, DbViolation, DbAuditLog, DbBugAward } from '../config/types';

export class CompetitionService {
  private async getPrimaryEventId(): Promise<string> {
    const event = await queryOne<DbEvent>(
      `SELECT * FROM events ORDER BY "createdAt" ASC LIMIT 1`
    );
    if (!event) {
      const newEvent = await queryOne<DbEvent>(
        `INSERT INTO events (id, name, status, "createdAt", "updatedAt")
         VALUES ('coding-challenge-2026-event-id', 'Coding Challenge 2026', 'DRAFT', NOW(), NOW())
         RETURNING *`
      );
      return newEvent!.id;
    }
    return event.id;
  }

  /**
   * Calculates final scores and ranks deterministically for all students.
   * Tie-breaking rules:
   * 1. Higher total score
   * 2. Higher score in later/higher-priority round (Round 3 > Round 2 > Round 1)
   * 3. Less total execution time
   * 4. Fewer compile attempts
   * 5. Earlier final submission timestamp
   */
  public async calculateFinalScores(eventId?: string) {
    const targetEventId = eventId || (await this.getPrimaryEventId());

    const rounds = await query<DbRound>(
      `SELECT * FROM rounds WHERE "eventId" = $1 AND "isEnabled" = true ORDER BY "order" ASC`,
      [targetEventId]
    );

    const round1Obj = rounds.find((r) => r.order === 1 || r.type === RoundType.MCQ);
    const round2Obj = rounds.find((r) => r.order === 2 || r.type === RoundType.DEBUGGING);
    const round3Obj = rounds.find((r) => r.order === 3 || r.type === RoundType.PROGRAMMING);

    const students = await query<DbStudent>(`SELECT * FROM students`);

    const studentCalculatedList = await Promise.all(
      students.map(async (st) => {
        const scores = await query<DbRoundScore>(
          `SELECT * FROM round_scores WHERE "studentId" = $1`,
          [st.id]
        );

        const r1ScoreObj = round1Obj ? scores.find((s) => s.roundId === round1Obj.id) : null;
        const r2ScoreObj = round2Obj ? scores.find((s) => s.roundId === round2Obj.id) : null;
        const r3ScoreObj = round3Obj ? scores.find((s) => s.roundId === round3Obj.id) : null;

        const round1Score = r1ScoreObj?.score || 0;
        const round2Score = r2ScoreObj?.score || 0;
        const round3Score = r3ScoreObj?.score || 0;
        const totalScore = round1Score + round2Score + round3Score;

        const progSubmissions = await query<DbProgrammingSubmission>(
          `SELECT "executionTime", "compileAttempts", "submittedAt" FROM programming_submissions WHERE "studentId" = $1 ORDER BY "submittedAt" DESC LIMIT 5`,
          [st.id]
        );

        const debugSubmissions = await query<DbDebuggingSubmission>(
          `SELECT "executionTime", "submittedAt" FROM debugging_submissions WHERE "studentId" = $1 ORDER BY "submittedAt" DESC LIMIT 5`,
          [st.id]
        );

        let totalExecutionTime = 0;
        let totalCompileAttempts = 0;
        let latestSubmissionMs = 0;

        progSubmissions.forEach((sub) => {
          if (sub.executionTime) totalExecutionTime += sub.executionTime;
          if (sub.compileAttempts) totalCompileAttempts += sub.compileAttempts;
          if (sub.submittedAt) {
            latestSubmissionMs = Math.max(latestSubmissionMs, new Date(sub.submittedAt).getTime());
          }
        });

        debugSubmissions.forEach((sub) => {
          if (sub.executionTime) totalExecutionTime += sub.executionTime;
          if (sub.submittedAt) {
            latestSubmissionMs = Math.max(latestSubmissionMs, new Date(sub.submittedAt).getTime());
          }
        });

        return {
          studentId: st.id,
          rawStudent: st,
          round1Score,
          round2Score,
          round3Score,
          totalScore,
          totalExecutionTime,
          totalCompileAttempts,
          latestSubmissionMs: latestSubmissionMs || Date.now(),
        };
      })
    );

    // Deterministic sorting with 5-tier tie-breaking rules
    studentCalculatedList.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.round3Score !== a.round3Score) return b.round3Score - a.round3Score;
      if (b.round2Score !== a.round2Score) return b.round2Score - a.round2Score;
      if (b.round1Score !== a.round1Score) return b.round1Score - a.round1Score;
      if (a.totalExecutionTime !== b.totalExecutionTime) return a.totalExecutionTime - b.totalExecutionTime;
      if (a.totalCompileAttempts !== b.totalCompileAttempts) return a.totalCompileAttempts - b.totalCompileAttempts;
      return a.latestSubmissionMs - b.latestSubmissionMs;
    });

    // Persist FinalScore records with assigned ranks
    await transaction(async (client) => {
      for (let index = 0; index < studentCalculatedList.length; index++) {
        const item = studentCalculatedList[index];
        const rank = index + 1;

        await txExecute(client,
          `INSERT INTO final_scores (id, "studentId", "round1Score", "round2Score", "round3Score", "totalScore", rank, status, "calculatedAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'FINAL', NOW(), NOW())
           ON CONFLICT ("studentId")
           DO UPDATE SET "round1Score" = $2, "round2Score" = $3, "round3Score" = $4,
                         "totalScore" = $5, rank = $6, status = 'FINAL', "updatedAt" = NOW()`,
          [item.studentId, item.round1Score, item.round2Score, item.round3Score, item.totalScore, rank]
        );
      }
    });

    return studentCalculatedList;
  }

  public async getAdminLeaderboard(eventId?: string) {
    const targetEventId = eventId || (await this.getPrimaryEventId());
    await this.calculateFinalScores(targetEventId);

    const event = await queryOne<DbEvent>(`SELECT * FROM events WHERE id = $1`, [targetEventId]);
    const visibility = await queryOne<DbVisibilitySettings>(`SELECT * FROM visibility_settings WHERE "eventId" = $1`, [targetEventId]);

    const finalScores = await query<DbFinalScore & { student_studentId: string; student_fullName: string; student_batchNumber: string; student_status: string }>(
      `SELECT fs.*, s."studentId" as "student_studentId", s."fullName" as "student_fullName", s."batchNumber" as "student_batchNumber", s.status as student_status
       FROM final_scores fs
       JOIN students s ON s.id = fs."studentId"
       ORDER BY fs.rank ASC`
    );

    return {
      eventId: targetEventId,
      showResults: visibility?.showResults ?? false,
      leaderboard: finalScores.map((fs) => ({
        rank: fs.rank,
        studentId: fs.student_studentId,
        studentName: fs.student_fullName,
        batchNumber: fs.student_batchNumber,
        round1Score: fs.round1Score,
        round2Score: fs.round2Score,
        round3Score: fs.round3Score,
        totalScore: fs.totalScore,
        status: fs.status,
      })),
    };
  }

  public async getStudentLeaderboard(studentDbId: string, eventId?: string) {
    const targetEventId = eventId || (await this.getPrimaryEventId());

    const visibility = await queryOne<DbVisibilitySettings>(
      `SELECT * FROM visibility_settings WHERE "eventId" = $1`,
      [targetEventId]
    );

    if (!visibility?.showResults) {
      throw {
        statusCode: 403,
        message: 'Competition results are not yet published by the administrator',
      };
    }

    const leaderboardData = await this.getAdminLeaderboard(targetEventId);
    const myScore = leaderboardData.leaderboard.find((item) => item.studentId === studentDbId || item.studentId.toLowerCase() === studentDbId.toLowerCase());

    return {
      showResults: true,
      myResult: myScore || null,
      leaderboard: leaderboardData.leaderboard,
    };
  }

  public async toggleResultsVisibility(showResults: boolean, userId?: string) {
    const targetEventId = await this.getPrimaryEventId();

    const updatedVisibility = await queryOne<DbVisibilitySettings>(
      `INSERT INTO visibility_settings (id, "eventId", "showAnswers", "showResults", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, false, $2, NOW(), NOW())
       ON CONFLICT ("eventId")
       DO UPDATE SET "showResults" = $2, "updatedAt" = NOW()
       RETURNING *`,
      [targetEventId, showResults]
    );

    await query(
      `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, 'Event', $2, $3, $4, NOW())`,
      [showResults ? 'RESULTS_PUBLISHED' : 'RESULTS_UNPUBLISHED', targetEventId, userId || null, JSON.stringify({ showResults })]
    );

    return updatedVisibility;
  }

  public async getAdminStudentInspection(studentIdOrDbId: string) {
    const student = await queryOne<DbStudent & { user_username: string; user_isActive: boolean }>(
      `SELECT s.*, u.username as user_username, u."isActive" as "user_isActive"
       FROM students s
       JOIN users u ON u.id = s."userId"
       WHERE s.id = $1 OR s."studentId" = $1`,
      [studentIdOrDbId]
    );

    if (!student) {
      throw { statusCode: 404, message: 'Student not found' };
    }

    const answers = await query<DbStudentAnswer & { question_text: string; question_marks: number; question_correctAnswer: string | null }>(
      `SELECT sa.*, q."questionText" as question_text, q.marks as question_marks, q."correctAnswer" as "question_correctAnswer"
       FROM student_answers sa
       JOIN questions q ON q.id = sa."questionId"
       WHERE sa."studentId" = $1`,
      [student.id]
    );

    const debuggingSubmissions = await query<DbDebuggingSubmission>(
      `SELECT * FROM debugging_submissions WHERE "studentId" = $1 ORDER BY "submittedAt" DESC LIMIT 5`,
      [student.id]
    );

    const bugAwards = await query<DbBugAward & { bug_title: string; bug_bugId: string }>(
      `SELECT ba.*, bd.title as bug_title, bd."bugId" as "bug_bugId"
       FROM bug_awards ba
       JOIN bug_definitions bd ON bd.id = ba."bugDefinitionId"
       WHERE ba."studentId" = $1`,
      [student.id]
    );

    const programmingSubmissions = await query<DbProgrammingSubmission>(
      `SELECT * FROM programming_submissions WHERE "studentId" = $1 ORDER BY "submittedAt" DESC LIMIT 5`,
      [student.id]
    );

    const progresses = await query<DbRoundProgress & { round_name: string; round_type: string; round_order: number }>(
      `SELECT rp.*, r.name as round_name, r.type as round_type, r.order as round_order
       FROM round_progress rp
       JOIN rounds r ON r.id = rp."roundId"
       WHERE rp."studentId" = $1`,
      [student.id]
    );

    const scores = await query<DbRoundScore & { round_name: string; round_type: string }>(
      `SELECT rs.*, r.name as round_name, r.type as round_type
       FROM round_scores rs
       JOIN rounds r ON r.id = rs."roundId"
       WHERE rs."studentId" = $1`,
      [student.id]
    );

    const violations = await query<DbViolation>(
      `SELECT * FROM violations WHERE "studentId" = $1 ORDER BY timestamp DESC`,
      [student.id]
    );

    const finalScore = await queryOne<DbFinalScore>(
      `SELECT * FROM final_scores WHERE "studentId" = $1`,
      [student.id]
    );

    return {
      ...student,
      user: { username: student.user_username, isActive: student.user_isActive },
      answers,
      debuggingSubmissions,
      bugAwards,
      programmingSubmissions,
      progresses,
      scores,
      violations,
      finalScore,
    };
  }
}

export const competitionService = new CompetitionService();
