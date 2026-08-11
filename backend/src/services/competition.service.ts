import { prisma } from '../config/database';
import { RoundType, RoundStatus } from '@prisma/client';

export class CompetitionService {
  /**
   * Helper to retrieve primary event ID.
   */
  private async getPrimaryEventId(): Promise<string> {
    const event = await prisma.event.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!event) {
      const newEvent = await prisma.event.create({
        data: {
          id: 'coding-challenge-2026-event-id',
          name: 'Coding Challenge 2026',
          status: 'DRAFT',
        },
      });
      return newEvent.id;
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

    const rounds = await prisma.round.findMany({
      where: { eventId: targetEventId, isEnabled: true },
      orderBy: { order: 'asc' },
    });

    const round1Obj = rounds.find((r) => r.order === 1 || r.type === RoundType.MCQ);
    const round2Obj = rounds.find((r) => r.order === 2 || r.type === RoundType.DEBUGGING);
    const round3Obj = rounds.find((r) => r.order === 3 || r.type === RoundType.PROGRAMMING);

    const students = await prisma.student.findMany({
      include: {
        scores: true,
        programmingSubmissions: {
          orderBy: { submittedAt: 'desc' },
          take: 5,
        },
        debuggingSubmissions: {
          orderBy: { submittedAt: 'desc' },
          take: 5,
        },
      },
    });

    const studentCalculatedList = students.map((st) => {
      const r1ScoreObj = round1Obj ? st.scores.find((s) => s.roundId === round1Obj.id) : null;
      const r2ScoreObj = round2Obj ? st.scores.find((s) => s.roundId === round2Obj.id) : null;
      const r3ScoreObj = round3Obj ? st.scores.find((s) => s.roundId === round3Obj.id) : null;

      const round1Score = r1ScoreObj?.score || 0;
      const round2Score = r2ScoreObj?.score || 0;
      const round3Score = r3ScoreObj?.score || 0;
      const totalScore = round1Score + round2Score + round3Score;

      // Collect tie-breaking metrics
      let totalExecutionTime = 0;
      let totalCompileAttempts = 0;
      let latestSubmissionMs = 0;

      st.programmingSubmissions.forEach((sub) => {
        if (sub.executionTime) totalExecutionTime += sub.executionTime;
        if (sub.compileAttempts) totalCompileAttempts += sub.compileAttempts;
        if (sub.submittedAt) {
          latestSubmissionMs = Math.max(latestSubmissionMs, sub.submittedAt.getTime());
        }
      });

      st.debuggingSubmissions.forEach((sub) => {
        if (sub.executionTime) totalExecutionTime += sub.executionTime;
        if (sub.submittedAt) {
          latestSubmissionMs = Math.max(latestSubmissionMs, sub.submittedAt.getTime());
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
    });

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
    await prisma.$transaction(
      studentCalculatedList.map((item, index) => {
        const rank = index + 1;
        return prisma.finalScore.upsert({
          where: { studentId: item.studentId },
          create: {
            studentId: item.studentId,
            round1Score: item.round1Score,
            round2Score: item.round2Score,
            round3Score: item.round3Score,
            totalScore: item.totalScore,
            rank,
            status: 'FINAL',
          },
          update: {
            round1Score: item.round1Score,
            round2Score: item.round2Score,
            round3Score: item.round3Score,
            totalScore: item.totalScore,
            rank,
            status: 'FINAL',
          },
        });
      })
    );

    return studentCalculatedList;
  }

  /**
   * Retrieves full admin leaderboard.
   */
  public async getAdminLeaderboard(eventId?: string) {
    const targetEventId = eventId || (await this.getPrimaryEventId());
    await this.calculateFinalScores(targetEventId);

    const event = await prisma.event.findUnique({
      where: { id: targetEventId },
      include: { visibility: true },
    });

    const finalScores = await prisma.finalScore.findMany({
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            fullName: true,
            batchNumber: true,
            status: true,
          },
        },
      },
      orderBy: { rank: 'asc' },
    });

    return {
      eventId: targetEventId,
      showResults: event?.visibility?.showResults ?? false,
      leaderboard: finalScores.map((fs) => ({
        rank: fs.rank,
        studentId: fs.student.studentId,
        studentName: fs.student.fullName,
        batchNumber: fs.student.batchNumber,
        round1Score: fs.round1Score,
        round2Score: fs.round2Score,
        round3Score: fs.round3Score,
        totalScore: fs.totalScore,
        status: fs.status,
      })),
    };
  }

  /**
   * Student leaderboard retrieval, strictly guarded by VisibilitySettings.showResults.
   */
  public async getStudentLeaderboard(studentDbId: string, eventId?: string) {
    const targetEventId = eventId || (await this.getPrimaryEventId());

    const visibility = await prisma.visibilitySettings.findUnique({
      where: { eventId: targetEventId },
    });

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

  /**
   * Admin toggle for results visibility (showResults flag).
   */
  public async toggleResultsVisibility(showResults: boolean, userId?: string) {
    const targetEventId = await this.getPrimaryEventId();

    const updatedVisibility = await prisma.visibilitySettings.upsert({
      where: { eventId: targetEventId },
      create: {
        eventId: targetEventId,
        showResults,
      },
      update: {
        showResults,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: showResults ? 'RESULTS_PUBLISHED' : 'RESULTS_UNPUBLISHED',
        entity: 'Event',
        entityId: targetEventId,
        userId,
        metadata: { showResults },
      },
    });

    return updatedVisibility;
  }

  /**
   * Comprehensive admin inspection tool for a single student.
   */
  public async getAdminStudentInspection(studentIdOrDbId: string) {
    const student = await prisma.student.findFirst({
      where: {
        OR: [{ id: studentIdOrDbId }, { studentId: studentIdOrDbId }],
      },
      include: {
        user: { select: { username: true, isActive: true } },
        answers: {
          include: {
            question: {
              select: { id: true, questionText: true, marks: true, correctAnswer: true },
            },
          },
        },
        debuggingSubmissions: {
          orderBy: { submittedAt: 'desc' },
          take: 5,
        },
        bugAwards: {
          include: { bugDefinition: true },
        },
        programmingSubmissions: {
          orderBy: { submittedAt: 'desc' },
          take: 5,
        },
        progresses: {
          include: { round: { select: { id: true, name: true, type: true, order: true } } },
        },
        scores: {
          include: { round: { select: { id: true, name: true, type: true } } },
        },
        violations: {
          orderBy: { timestamp: 'desc' },
        },
        finalScore: true,
      },
    });

    if (!student) {
      throw { statusCode: 404, message: 'Student not found' };
    }

    return student;
  }
}

export const competitionService = new CompetitionService();
