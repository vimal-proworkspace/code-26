import { RoundStatus, RoundProgressStatus, QuestionType, ProgrammingLanguage, DbDebuggingProblem, DbBugDefinition, DbBugAward, DbDebuggingSubmission, DbRoundProgress, DbRoundScore, DbRound } from '../config/types';
import { query, queryOne, transaction, txQuery, txQueryOne, txExecute } from '../config/database';
import { codeExecutionService } from './execution/codeExecutionService';
import { TestCaseInput } from './execution/types';

export interface CreateDebuggingProblemInput {
  title: string;
  description: string;
  buggyCode: string;
  solutionCode?: string;
  starterCode?: string;
  maximumMarks: number;
  timeLimit?: number;
  memoryLimit?: number;
  isActive?: boolean;
}

export interface UpdateDebuggingProblemInput {
  title?: string;
  description?: string;
  buggyCode?: string;
  solutionCode?: string;
  starterCode?: string;
  maximumMarks?: number;
  timeLimit?: number;
  memoryLimit?: number;
  isActive?: boolean;
}

export interface CreateBugDefinitionInput {
  bugId: string;
  title: string;
  description?: string;
  marks: number;
  validationConfig?: {
    input?: string;
    expectedOutput?: string;
    comparisonMethod?: 'EXACT' | 'TRIM' | 'EXACT_IGNORE_CASE';
    mustInclude?: string[];
    mustExclude?: string[];
    pattern?: string;
  };
  order?: number;
  isActive?: boolean;
}

export interface UpdateBugDefinitionInput {
  bugId?: string;
  title?: string;
  description?: string;
  marks?: number;
  validationConfig?: any;
  order?: number;
  isActive?: boolean;
}

export class Round2Service {
  private async logAudit(action: string, entityId: string, userId?: string, metadata?: Record<string, unknown>) {
    try {
      await query(
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), $1, 'DebuggingProblem', $2, $3, $4, NOW())`,
        [action, entityId, userId || null, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (err) {
      console.error('Failed to log audit for Round 2:', err);
    }
  }

  // ==========================================
  // ADMIN PROBLEM & BUG MANAGEMENT
  // ==========================================

  public async getAdminProblems(roundId: string) {
    const problems = await query<DbDebuggingProblem>(
      `SELECT * FROM debugging_problems WHERE "roundId" = $1 ORDER BY "createdAt" ASC`,
      [roundId]
    );

    return Promise.all(
      problems.map(async (p) => {
        const bugDefinitions = await query<DbBugDefinition>(
          `SELECT * FROM bug_definitions WHERE "debuggingProblemId" = $1 ORDER BY "order" ASC`,
          [p.id]
        );
        const subCount = await queryOne<{ count: string }>(
          `SELECT COUNT(*) FROM debugging_submissions WHERE "debuggingProblemId" = $1`,
          [p.id]
        );

        return {
          ...p,
          bugDefinitions,
          _count: { submissions: parseInt(subCount?.count || '0', 10) },
        };
      })
    );
  }

  public async createDebuggingProblem(roundId: string, input: CreateDebuggingProblemInput, userId?: string) {
    const title = (input.title || '').trim();
    const description = (input.description || '').trim();
    const buggyCode = input.buggyCode || '';

    if (!title || !description || !buggyCode) {
      throw { statusCode: 400, message: 'Title, description, and buggy C code are required' };
    }

    const problem = await queryOne<DbDebuggingProblem>(
      `INSERT INTO debugging_problems (id, "roundId", title, description, "buggyCode", "solutionCode", "starterCode", "maximumMarks", "timeLimit", "memoryLimit", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        roundId,
        title,
        description,
        buggyCode,
        input.solutionCode || null,
        input.starterCode || buggyCode,
        input.maximumMarks ?? 10,
        input.timeLimit ?? 2000,
        input.memoryLimit ?? 128000,
        input.isActive ?? true,
      ]
    );

    if (!problem) {
      throw { statusCode: 500, message: 'Failed to create debugging problem' };
    }

    await this.logAudit('ROUND2_PROBLEM_CREATED', problem.id, userId, { title });
    return problem;
  }

  public async updateDebuggingProblem(problemId: string, input: UpdateDebuggingProblemInput, userId?: string) {
    const existing = await queryOne<DbDebuggingProblem>(`SELECT * FROM debugging_problems WHERE id = $1`, [problemId]);
    if (!existing) {
      throw { statusCode: 404, message: 'Debugging problem not found' };
    }

    const title = input.title !== undefined ? input.title.trim() : existing.title;
    const description = input.description !== undefined ? input.description.trim() : existing.description;
    const buggyCode = input.buggyCode !== undefined ? input.buggyCode : existing.buggyCode;
    const solutionCode = input.solutionCode !== undefined ? input.solutionCode : existing.solutionCode;
    const starterCode = input.starterCode !== undefined ? input.starterCode : existing.starterCode;
    const maximumMarks = input.maximumMarks !== undefined ? input.maximumMarks : existing.maximumMarks;
    const timeLimit = input.timeLimit !== undefined ? input.timeLimit : existing.timeLimit;
    const memoryLimit = input.memoryLimit !== undefined ? input.memoryLimit : existing.memoryLimit;
    const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;

    const problem = await queryOne<DbDebuggingProblem>(
      `UPDATE debugging_problems
       SET title = $1, description = $2, "buggyCode" = $3, "solutionCode" = $4,
           "starterCode" = $5, "maximumMarks" = $6, "timeLimit" = $7, "memoryLimit" = $8,
           "isActive" = $9, "updatedAt" = NOW()
       WHERE id = $10
       RETURNING *`,
      [title, description, buggyCode, solutionCode, starterCode, maximumMarks, timeLimit, memoryLimit, isActive, problemId]
    );

    await this.logAudit('ROUND2_PROBLEM_UPDATED', problem!.id, userId, { title: problem!.title });
    return problem;
  }

  public async deleteDebuggingProblem(problemId: string, userId?: string) {
    const existing = await queryOne<DbDebuggingProblem>(`SELECT * FROM debugging_problems WHERE id = $1`, [problemId]);
    if (!existing) {
      throw { statusCode: 404, message: 'Debugging problem not found' };
    }

    await query(`DELETE FROM debugging_problems WHERE id = $1`, [problemId]);
    await this.logAudit('ROUND2_PROBLEM_DELETED', problemId, userId, { title: existing.title });
    return { status: 'success', message: 'Debugging problem deleted' };
  }

  public async createBugDefinition(problemId: string, input: CreateBugDefinitionInput, userId?: string) {
    const bugId = (input.bugId || '').trim();
    const title = (input.title || '').trim();

    if (!bugId || !title) {
      throw { statusCode: 400, message: 'Bug ID and title are required' };
    }

    if (input.marks === undefined || input.marks < 0) {
      throw { statusCode: 400, message: 'Marks must be a non-negative number' };
    }

    const problem = await queryOne<DbDebuggingProblem>(`SELECT * FROM debugging_problems WHERE id = $1`, [problemId]);
    if (!problem) {
      throw { statusCode: 404, message: 'Debugging problem not found' };
    }

    const bugCountRes = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM bug_definitions WHERE "debuggingProblemId" = $1`,
      [problemId]
    );
    const bugCount = parseInt(bugCountRes?.count || '0', 10);

    const bug = await queryOne<DbBugDefinition>(
      `INSERT INTO bug_definitions (id, "debuggingProblemId", "bugId", title, description, marks, "validationConfig", "order", "isActive")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        problemId,
        bugId,
        title,
        input.description || null,
        input.marks,
        input.validationConfig ? JSON.stringify(input.validationConfig) : '{}',
        input.order ?? bugCount + 1,
        input.isActive ?? true,
      ]
    );

    if (!bug) {
      throw { statusCode: 500, message: 'Failed to create bug definition' };
    }

    await this.logAudit('BUG_DEFINITION_CREATED', bug.id, userId, { bugId, problemId });
    return bug;
  }

  public async updateBugDefinition(bugDefinitionId: string, input: UpdateBugDefinitionInput, userId?: string) {
    const existing = await queryOne<DbBugDefinition>(`SELECT * FROM bug_definitions WHERE id = $1`, [bugDefinitionId]);
    if (!existing) {
      throw { statusCode: 404, message: 'Bug definition not found' };
    }

    const bugId = input.bugId !== undefined ? input.bugId.trim() : existing.bugId;
    const title = input.title !== undefined ? input.title.trim() : existing.title;
    const description = input.description !== undefined ? input.description : existing.description;
    const marks = input.marks !== undefined ? input.marks : existing.marks;
    const validationConfig = input.validationConfig !== undefined ? JSON.stringify(input.validationConfig) : existing.validationConfig;
    const order = input.order !== undefined ? input.order : existing.order;
    const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;

    const bug = await queryOne<DbBugDefinition>(
      `UPDATE bug_definitions
       SET "bugId" = $1, title = $2, description = $3, marks = $4, "validationConfig" = $5, "order" = $6, "isActive" = $7
       WHERE id = $8
       RETURNING *`,
      [bugId, title, description, marks, validationConfig, order, isActive, bugDefinitionId]
    );

    await this.logAudit('BUG_DEFINITION_UPDATED', bug!.id, userId, { bugId: bug!.bugId });
    return bug;
  }

  public async deleteBugDefinition(bugDefinitionId: string, userId?: string) {
    const existing = await queryOne<DbBugDefinition>(`SELECT * FROM bug_definitions WHERE id = $1`, [bugDefinitionId]);
    if (!existing) {
      throw { statusCode: 404, message: 'Bug definition not found' };
    }

    await query(`DELETE FROM bug_definitions WHERE id = $1`, [bugDefinitionId]);
    await this.logAudit('BUG_DEFINITION_DELETED', bugDefinitionId, userId, { bugId: existing.bugId });
    return { status: 'success', message: 'Bug definition deleted' };
  }

  // ==========================================
  // STUDENT WORKSPACE & EXECUTION
  // ==========================================

  public async getStudentRound2(roundId: string, studentId: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);

    if (!round) {
      throw { statusCode: 404, message: 'Round 2 not found' };
    }

    if (round.status !== 'LIVE') {
      throw { statusCode: 400, message: `Round 2 is currently ${round.status}. Accessible only when LIVE.` };
    }

    const progress = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );

    const isSubmitted = progress?.status === 'SUBMITTED';

    const problem = await queryOne<DbDebuggingProblem>(
      `SELECT * FROM debugging_problems WHERE "roundId" = $1 AND "isActive" = true ORDER BY "createdAt" ASC LIMIT 1`,
      [roundId]
    );

    if (!problem) {
      throw { statusCode: 404, message: 'No active debugging problem found for Round 2' };
    }

    const now = Date.now();
    const endTimeMs = round.endTime ? new Date(round.endTime).getTime() : now;
    const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));

    let savedCode = problem.buggyCode;
    if (progress?.stateData && typeof progress.stateData === 'object') {
      const data = progress.stateData as Record<string, any>;
      if (typeof data.code === 'string' && data.code.length > 0) {
        savedCode = data.code;
      }
    }

    return {
      isSubmitted,
      submittedAt: progress?.submittedAt || null,
      round: {
        id: round.id,
        name: round.name,
        duration: round.duration,
        remainingSeconds,
        endTime: round.endTime,
      },
      problem: {
        id: problem.id,
        title: problem.title,
        description: problem.description,
        buggyCode: problem.buggyCode,
        savedCode,
        timeLimit: problem.timeLimit,
        memoryLimit: problem.memoryLimit,
      },
    };
  }

  public async saveStudentCode(roundId: string, studentId: string, code: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);

    if (!round || round.status !== 'LIVE') {
      throw { statusCode: 400, message: 'Cannot save code: Round 2 is not LIVE' };
    }

    if (round.endTime && new Date() > new Date(round.endTime)) {
      throw { statusCode: 400, message: 'Round 2 deadline has passed' };
    }

    const progress = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );

    if (progress && progress.status === 'LOCKED') {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    if (progress && progress.status === 'SUBMITTED') {
      throw { statusCode: 400, message: 'Cannot modify code: Round 2 has been submitted' };
    }

    const updatedProgress = await queryOne<DbRoundProgress>(
      `INSERT INTO round_progress (id, "studentId", "roundId", status, "startedAt", "lastSavedAt", "stateData")
       VALUES (gen_random_uuid(), $1, $2, 'IN_PROGRESS', NOW(), NOW(), $3)
       ON CONFLICT ("studentId", "roundId")
       DO UPDATE SET status = 'IN_PROGRESS', "lastSavedAt" = NOW(), "stateData" = $3
       RETURNING *`,
      [studentId, roundId, JSON.stringify({ code })]
    );

    return { status: 'success', lastSavedAt: updatedProgress!.lastSavedAt };
  }

  public async runStudentCode(roundId: string, studentId: string, problemId: string, code: string, inputStr: string = '') {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);

    if (!round || round.status !== 'LIVE') {
      throw { statusCode: 400, message: 'Cannot run code: Round 2 is not LIVE' };
    }

    if (round.endTime && new Date() > new Date(round.endTime)) {
      throw { statusCode: 400, message: 'Round 2 deadline has passed' };
    }

    const progressRun = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );
    if (progressRun && progressRun.status === 'LOCKED') {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    const testCase: TestCaseInput = {
      id: 'sample_run',
      input: inputStr || '',
      expectedOutput: '',
      marks: 0,
      visibility: 'VISIBLE',
    };

    const executionResult = await codeExecutionService.runCode({
      language: ProgrammingLanguage.C,
      sourceCode: code,
      testCases: [testCase],
      timeLimitMs: 2000,
    });

    return {
      compileStatus: executionResult.compileStatus,
      compileOutput: executionResult.compileOutput || '',
      executionOutput: executionResult.testResults[0]?.actualOutput || '',
      executionError: executionResult.testResults[0]?.errorOutput || '',
      status: executionResult.submissionStatus,
      executionTimeMs: executionResult.totalExecutionTimeMs,
    };
  }

  public async submitStudentCode(roundId: string, studentId: string, problemId: string, code: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);

    if (!round || round.status !== 'LIVE') {
      throw { statusCode: 400, message: 'Cannot submit code: Round 2 is not LIVE' };
    }

    if (round.endTime && new Date() > new Date(round.endTime)) {
      throw { statusCode: 400, message: 'Round 2 deadline has passed' };
    }

    const progressSub = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );
    if (progressSub && progressSub.status === 'LOCKED') {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    const problem = await queryOne<DbDebuggingProblem>(
      `SELECT * FROM debugging_problems WHERE id = $1`,
      [problemId]
    );

    if (!problem) {
      throw { statusCode: 404, message: 'Debugging problem not found' };
    }

    const bugDefinitions = await query<DbBugDefinition>(
      `SELECT * FROM bug_definitions WHERE "debuggingProblemId" = $1 AND "isActive" = true ORDER BY "order" ASC`,
      [problemId]
    );

    const sampleTestCase: TestCaseInput = {
      id: 'compilation_check',
      input: '',
      expectedOutput: '',
      marks: 0,
      visibility: 'VISIBLE',
    };

    const compileCheck = await codeExecutionService.runCode({
      language: ProgrammingLanguage.C,
      sourceCode: code,
      testCases: [sampleTestCase],
      timeLimitMs: 2000,
    });

    const compileStatus = compileCheck.compileStatus;
    const compileOutput = compileCheck.compileOutput || '';

    const newlyFixedBugIds: string[] = [];
    let compilationFailed = compileStatus === 'COMPILATION_ERROR';

    if (!compilationFailed) {
      for (const bugDef of bugDefinitions) {
        const isFixed = await this.validateBug(code, bugDef.validationConfig);
        if (isFixed) {
          newlyFixedBugIds.push(bugDef.id);
        }
      }
    }

    return await transaction(async (client) => {
      const subCountRes = await txQueryOne<{ count: string }>(client,
        `SELECT COUNT(*) FROM debugging_submissions WHERE "studentId" = $1 AND "debuggingProblemId" = $2`,
        [studentId, problemId]
      );
      const subCount = parseInt(subCountRes?.count || '0', 10);

      const existingAwards = await txQuery<DbBugAward>(client,
        `SELECT * FROM bug_awards WHERE "studentId" = $1 AND "bugDefinitionId" = ANY($2)`,
        [studentId, bugDefinitions.map((b) => b.id)]
      );

      const awardedBugDefIds = new Set(existingAwards.map((a) => a.bugDefinitionId));
      const bugsToAward = bugDefinitions.filter((b) => newlyFixedBugIds.includes(b.id) && !awardedBugDefIds.has(b.id));

      let newScorePoints = 0;

      const submission = await txQueryOne<DbDebuggingSubmission>(client,
        `INSERT INTO debugging_submissions (id, "studentId", "debuggingProblemId", "submittedCode", "submissionNumber", "compileStatus", "compileOutput", "executionOutput", "executionTime", score, "submittedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 0, NOW())
         RETURNING *`,
        [
          studentId,
          problemId,
          code,
          subCount + 1,
          compileStatus,
          compileOutput,
          compileCheck.testResults[0]?.actualOutput || '',
          compileCheck.totalExecutionTimeMs,
        ]
      );

      for (const bug of bugsToAward) {
        try {
          await txExecute(client,
            `INSERT INTO bug_awards (id, "studentId", "bugDefinitionId", "debuggingSubmissionId", "marksAwarded", "awardedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
             ON CONFLICT ("studentId", "bugDefinitionId") DO NOTHING`,
            [studentId, bug.id, submission!.id, bug.marks]
          );
          newScorePoints += bug.marks;
        } catch (err: any) {
          console.warn(`Bug award concurrency skipped for bug ${bug.id}:`, err?.message);
        }
      }

      const allAwards = await txQuery<DbBugAward>(client,
        `SELECT ba.* FROM bug_awards ba JOIN bug_definitions bd ON bd.id = ba."bugDefinitionId" WHERE ba."studentId" = $1 AND bd."debuggingProblemId" = $2`,
        [studentId, problemId]
      );

      const totalScore = allAwards.reduce((sum, a) => sum + a.marksAwarded, 0);

      await txExecute(client,
        `UPDATE debugging_submissions SET score = $1 WHERE id = $2`,
        [totalScore, submission!.id]
      );

      await txExecute(client,
        `INSERT INTO round_scores (id, "studentId", "roundId", score, "maximumScore", "calculatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
         ON CONFLICT ("studentId", "roundId")
         DO UPDATE SET score = $3, "maximumScore" = $4, "calculatedAt" = NOW()`,
        [studentId, roundId, totalScore, problem.maximumMarks]
      );

      await txExecute(client,
        `INSERT INTO round_progress (id, "studentId", "roundId", status, "lastSavedAt", "stateData")
         VALUES (gen_random_uuid(), $1, $2, 'IN_PROGRESS', NOW(), $3)
         ON CONFLICT ("studentId", "roundId")
         DO UPDATE SET status = 'IN_PROGRESS', "lastSavedAt" = NOW(), "stateData" = $3`,
        [studentId, roundId, JSON.stringify({ code })]
      );

      return {
        status: 'success',
        submissionId: submission!.id,
        submissionNumber: submission!.submissionNumber,
        compileStatus: submission!.compileStatus,
        compileOutput: submission!.compileOutput,
        executionOutput: submission!.executionOutput,
        newlyFixedBugsCount: bugsToAward.length,
        totalFixedBugsCount: allAwards.length,
        newScorePoints,
        totalScore,
        maximumScore: problem.maximumMarks,
      };
    });
  }

  private async validateBug(code: string, validationConfigJson: any): Promise<boolean> {
    if (!validationConfigJson || typeof validationConfigJson !== 'object') {
      return false;
    }

    const config = validationConfigJson as {
      input?: string;
      expectedOutput?: string;
      comparisonMethod?: string;
      mustInclude?: string[];
      mustExclude?: string[];
      pattern?: string;
    };

    if (Array.isArray(config.mustInclude)) {
      for (const reqStr of config.mustInclude) {
        if (!code.includes(reqStr)) {
          return false;
        }
      }
    }

    if (Array.isArray(config.mustExclude)) {
      for (const forbiddenStr of config.mustExclude) {
        if (code.includes(forbiddenStr)) {
          return false;
        }
      }
    }

    if (config.pattern) {
      try {
        const regex = new RegExp(config.pattern);
        if (!regex.test(code)) {
          return false;
        }
      } catch (err) {
        console.error('Invalid regex pattern in bug validation config:', config.pattern);
      }
    }

    if (config.expectedOutput !== undefined) {
      const inputStr = config.input || '';
      const testCase: TestCaseInput = {
        id: 'bug_validation',
        input: inputStr,
        expectedOutput: config.expectedOutput,
        marks: 1,
        visibility: 'HIDDEN',
      };

      const result = await codeExecutionService.runCode({
        language: ProgrammingLanguage.C,
        sourceCode: code,
        testCases: [testCase],
        timeLimitMs: 2000,
      });

      if (result.compileStatus !== 'SUCCESS') {
        return false;
      }

      const actual = (result.testResults[0]?.actualOutput || '').trim();
      const expected = (config.expectedOutput || '').trim();

      const method = config.comparisonMethod || 'TRIM';

      if (method === 'EXACT') {
        return (result.testResults[0]?.actualOutput || '') === config.expectedOutput;
      } else if (method === 'EXACT_IGNORE_CASE') {
        return actual.toLowerCase() === expected.toLowerCase();
      } else {
        return actual === expected;
      }
    }

    return true;
  }

  // ==========================================
  // ADMIN INSPECTION & LEADERBOARD
  // ==========================================

  public async getAdminSubmissions(problemId: string, studentId?: string) {
    const conditions: string[] = [`"debuggingProblemId" = $1`];
    const params: any[] = [problemId];

    if (studentId) {
      params.push(studentId);
      conditions.push(`"studentId" = $${params.length}`);
    }

    const submissions = await query<DbDebuggingSubmission & { student_studentId: string; student_fullName: string; student_batchNumber: string }>(
      `SELECT ds.*, s."studentId" as "student_studentId", s."fullName" as "student_fullName", s."batchNumber" as "student_batchNumber"
       FROM debugging_submissions ds
       JOIN students s ON s.id = ds."studentId"
       WHERE ${conditions.join(' AND ')}
       ORDER BY ds."submittedAt" DESC`,
      params
    );

    return submissions.map((sub) => ({
      ...sub,
      student: {
        id: sub.studentId,
        studentId: sub.student_studentId,
        fullName: sub.student_fullName,
        batchNumber: sub.student_batchNumber,
      },
    }));
  }

  public async getRound2Scores(roundId: string) {
    const students = await query<{ id: string; studentId: string; fullName: string; batchNumber: string }>(
      `SELECT id, "studentId", "fullName", "batchNumber" FROM students ORDER BY "studentId" ASC`
    );

    return Promise.all(
      students.map(async (s) => {
        const score = await queryOne<DbRoundScore>(
          `SELECT score, "maximumScore" FROM round_scores WHERE "studentId" = $1 AND "roundId" = $2`,
          [s.id, roundId]
        );
        const progress = await queryOne<DbRoundProgress>(
          `SELECT status, "submittedAt" FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
          [s.id, roundId]
        );
        const bugAwards = await query<{ id: string }>(
          `SELECT ba.id FROM bug_awards ba JOIN bug_definitions bd ON bd.id = ba."bugDefinitionId" JOIN debugging_problems dp ON dp.id = bd."debuggingProblemId" WHERE ba."studentId" = $1 AND dp."roundId" = $2`,
          [s.id, roundId]
        );

        return {
          id: s.id,
          studentId: s.studentId,
          fullName: s.fullName,
          batchNumber: s.batchNumber,
          status: progress ? progress.status : 'NOT_STARTED',
          score: score ? score.score : 0,
          maximumScore: score ? score.maximumScore : 0,
          fixedBugsCount: bugAwards.length,
          submittedAt: progress ? progress.submittedAt : null,
        };
      })
    );
  }
}

export const round2Service = new Round2Service();
