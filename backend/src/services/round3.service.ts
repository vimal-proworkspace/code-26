import { RoundStatus, RoundProgressStatus, ProgrammingLanguage, TestCaseVisibility, DbProgrammingProblem, DbTestCase, DbProgrammingSubmission, DbRoundProgress, DbRoundScore, DbRound } from '../config/types';
import { query, queryOne, transaction, txQuery, txQueryOne, txExecute } from '../config/database';
import { codeExecutionService } from './execution/codeExecutionService';
import { TestCaseInput } from './execution/types';

export interface CreateProgrammingProblemInput {
  title: string;
  description: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  examples?: any;
  starterCode?: string;
  supportedLanguages?: string[];
  maximumMarks: number;
  timeLimit?: number;
  memoryLimit?: number;
  isActive?: boolean;
}

export interface UpdateProgrammingProblemInput {
  title?: string;
  description?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  examples?: any;
  starterCode?: string;
  supportedLanguages?: string[];
  maximumMarks?: number;
  timeLimit?: number;
  memoryLimit?: number;
  isActive?: boolean;
}

export interface CreateTestCaseInput {
  input: string;
  expectedOutput: string;
  marks: number;
  visibility?: TestCaseVisibility;
  order?: number;
  isActive?: boolean;
}

export interface UpdateTestCaseInput {
  input?: string;
  expectedOutput?: string;
  marks?: number;
  visibility?: TestCaseVisibility;
  order?: number;
  isActive?: boolean;
}

export class Round3Service {
  private async logAudit(action: string, entityId: string, userId?: string, metadata?: Record<string, unknown>) {
    try {
      await query(
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), $1, 'ProgrammingProblem', $2, $3, $4, NOW())`,
        [action, entityId, userId || null, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (err) {
      console.error('Failed to log audit for Round 3:', err);
    }
  }

  // ==========================================
  // ADMIN PROBLEM & TEST CASE MANAGEMENT
  // ==========================================

  public async getAdminProblems(roundId: string) {
    const problems = await query<DbProgrammingProblem>(
      `SELECT * FROM programming_problems WHERE "roundId" = $1 ORDER BY "createdAt" ASC`,
      [roundId]
    );

    return Promise.all(
      problems.map(async (p) => {
        const testCases = await query<DbTestCase>(
          `SELECT * FROM test_cases WHERE "programmingProblemId" = $1 ORDER BY "order" ASC`,
          [p.id]
        );
        const subCount = await queryOne<{ count: string }>(
          `SELECT COUNT(*) FROM programming_submissions WHERE "programmingProblemId" = $1`,
          [p.id]
        );

        return {
          ...p,
          testCases,
          _count: { submissions: parseInt(subCount?.count || '0', 10) },
        };
      })
    );
  }

  public async createProgrammingProblem(roundId: string, input: CreateProgrammingProblemInput, userId?: string) {
    const title = (input.title || '').trim();
    const description = (input.description || '').trim();

    if (!title || !description) {
      throw { statusCode: 400, message: 'Title and description are required' };
    }

    const defaultLanguages = input.supportedLanguages && input.supportedLanguages.length > 0
      ? input.supportedLanguages
      : ['C', 'CPP', 'JAVA', 'PYTHON'];

    const problem = await queryOne<DbProgrammingProblem>(
      `INSERT INTO programming_problems (id, "roundId", title, description, "inputFormat", "outputFormat", constraints, examples, "starterCode", "supportedLanguages", "maximumMarks", "timeLimit", "memoryLimit", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
       RETURNING *`,
      [
        roundId,
        title,
        description,
        input.inputFormat || null,
        input.outputFormat || null,
        input.constraints || null,
        input.examples ? JSON.stringify(input.examples) : null,
        input.starterCode || null,
        defaultLanguages,
        input.maximumMarks ?? 100,
        input.timeLimit ?? 2000,
        input.memoryLimit ?? 256000,
        input.isActive ?? true,
      ]
    );

    if (!problem) {
      throw { statusCode: 500, message: 'Failed to create programming problem' };
    }

    await this.logAudit('ROUND3_PROBLEM_CREATED', problem.id, userId, { title });
    return problem;
  }

  public async updateProgrammingProblem(problemId: string, input: UpdateProgrammingProblemInput, userId?: string) {
    const existing = await queryOne<DbProgrammingProblem>(`SELECT * FROM programming_problems WHERE id = $1`, [problemId]);
    if (!existing) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    const title = input.title !== undefined ? input.title.trim() : existing.title;
    const description = input.description !== undefined ? input.description.trim() : existing.description;
    const inputFormat = input.inputFormat !== undefined ? input.inputFormat : existing.inputFormat;
    const outputFormat = input.outputFormat !== undefined ? input.outputFormat : existing.outputFormat;
    const constraints = input.constraints !== undefined ? input.constraints : existing.constraints;
    const examples = input.examples !== undefined ? JSON.stringify(input.examples) : existing.examples;
    const starterCode = input.starterCode !== undefined ? input.starterCode : existing.starterCode;
    const supportedLanguages = input.supportedLanguages !== undefined ? input.supportedLanguages : existing.supportedLanguages;
    const maximumMarks = input.maximumMarks !== undefined ? input.maximumMarks : existing.maximumMarks;
    const timeLimit = input.timeLimit !== undefined ? input.timeLimit : existing.timeLimit;
    const memoryLimit = input.memoryLimit !== undefined ? input.memoryLimit : existing.memoryLimit;
    const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;

    const problem = await queryOne<DbProgrammingProblem>(
      `UPDATE programming_problems
       SET title = $1, description = $2, "inputFormat" = $3, "outputFormat" = $4,
           constraints = $5, examples = $6, "starterCode" = $7, "supportedLanguages" = $8,
           "maximumMarks" = $9, "timeLimit" = $10, "memoryLimit" = $11, "isActive" = $12, "updatedAt" = NOW()
       WHERE id = $13
       RETURNING *`,
      [title, description, inputFormat, outputFormat, constraints, examples, starterCode, supportedLanguages, maximumMarks, timeLimit, memoryLimit, isActive, problemId]
    );

    await this.logAudit('ROUND3_PROBLEM_UPDATED', problem!.id, userId, { title: problem!.title });
    return problem;
  }

  public async deleteProgrammingProblem(problemId: string, userId?: string) {
    const existing = await queryOne<DbProgrammingProblem>(`SELECT * FROM programming_problems WHERE id = $1`, [problemId]);
    if (!existing) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    await query(`DELETE FROM programming_problems WHERE id = $1`, [problemId]);
    await this.logAudit('ROUND3_PROBLEM_DELETED', problemId, userId, { title: existing.title });
    return { status: 'success', message: 'Programming problem deleted' };
  }

  public async createTestCase(problemId: string, input: CreateTestCaseInput, userId?: string) {
    const problem = await queryOne<DbProgrammingProblem>(`SELECT * FROM programming_problems WHERE id = $1`, [problemId]);
    if (!problem) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    const testCaseCountRes = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM test_cases WHERE "programmingProblemId" = $1`,
      [problemId]
    );
    const testCaseCount = parseInt(testCaseCountRes?.count || '0', 10);

    const testCase = await queryOne<DbTestCase>(
      `INSERT INTO test_cases (id, "programmingProblemId", input, "expectedOutput", marks, visibility, "order", "isActive")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        problemId,
        input.input || '',
        input.expectedOutput || '',
        input.marks ?? 10,
        input.visibility || TestCaseVisibility.VISIBLE,
        input.order ?? testCaseCount + 1,
        input.isActive ?? true,
      ]
    );

    if (!testCase) {
      throw { statusCode: 500, message: 'Failed to create test case' };
    }

    await this.logAudit('TEST_CASE_CREATED', testCase.id, userId, { problemId, visibility: testCase.visibility });
    return testCase;
  }

  public async updateTestCase(testCaseId: string, input: UpdateTestCaseInput, userId?: string) {
    const existing = await queryOne<DbTestCase>(`SELECT * FROM test_cases WHERE id = $1`, [testCaseId]);
    if (!existing) {
      throw { statusCode: 404, message: 'Test case not found' };
    }

    const inputVal = input.input !== undefined ? input.input : existing.input;
    const expectedOutput = input.expectedOutput !== undefined ? input.expectedOutput : existing.expectedOutput;
    const marks = input.marks !== undefined ? input.marks : existing.marks;
    const visibility = input.visibility !== undefined ? input.visibility : existing.visibility;
    const order = input.order !== undefined ? input.order : existing.order;
    const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;

    const testCase = await queryOne<DbTestCase>(
      `UPDATE test_cases
       SET input = $1, "expectedOutput" = $2, marks = $3, visibility = $4, "order" = $5, "isActive" = $6
       WHERE id = $7
       RETURNING *`,
      [inputVal, expectedOutput, marks, visibility, order, isActive, testCaseId]
    );

    await this.logAudit('TEST_CASE_UPDATED', testCase!.id, userId, { testCaseId });
    return testCase;
  }

  public async deleteTestCase(testCaseId: string, userId?: string) {
    const existing = await queryOne<DbTestCase>(`SELECT * FROM test_cases WHERE id = $1`, [testCaseId]);
    if (!existing) {
      throw { statusCode: 404, message: 'Test case not found' };
    }

    await query(`DELETE FROM test_cases WHERE id = $1`, [testCaseId]);
    await this.logAudit('TEST_CASE_DELETED', testCaseId, userId, { testCaseId });
    return { status: 'success', message: 'Test case deleted' };
  }

  // ==========================================
  // STUDENT WORKSPACE & EXECUTION
  // ==========================================

  public async getStudentRound3(roundId: string, studentId: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);

    if (!round) {
      throw { statusCode: 404, message: 'Round 3 not found' };
    }

    if (round.status !== 'LIVE') {
      throw { statusCode: 400, message: `Round 3 is currently ${round.status}. Accessible only when LIVE.` };
    }

    const progress = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );

    const isSubmitted = progress?.status === 'SUBMITTED';

    const problem = await queryOne<DbProgrammingProblem>(
      `SELECT * FROM programming_problems WHERE "roundId" = $1 AND "isActive" = true ORDER BY "createdAt" ASC LIMIT 1`,
      [roundId]
    );

    if (!problem) {
      throw { statusCode: 404, message: 'No active programming problem found for Round 3' };
    }

    const visibleTestCases = await query<DbTestCase>(
      `SELECT id, input, "expectedOutput", marks, "order" FROM test_cases WHERE "programmingProblemId" = $1 AND "isActive" = true AND visibility = 'VISIBLE' ORDER BY "order" ASC`,
      [problem.id]
    );

    const now = Date.now();
    const endTimeMs = round.endTime ? new Date(round.endTime).getTime() : now;
    const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));

    let savedCodeMap: Record<string, string> = {};
    if (progress?.stateData && typeof progress.stateData === 'object') {
      const data = progress.stateData as Record<string, any>;
      if (data.savedCodeMap && typeof data.savedCodeMap === 'object') {
        savedCodeMap = data.savedCodeMap;
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
        inputFormat: problem.inputFormat,
        outputFormat: problem.outputFormat,
        constraints: problem.constraints,
        examples: problem.examples,
        starterCode: problem.starterCode,
        supportedLanguages: problem.supportedLanguages,
        maximumMarks: problem.maximumMarks,
        timeLimit: problem.timeLimit,
        visibleTestCases,
        savedCodeMap,
      },
    };
  }

  public async saveStudentCode(roundId: string, studentId: string, language: string, code: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);

    if (!round || round.status !== 'LIVE') {
      throw { statusCode: 400, message: 'Cannot save code: Round 3 is not LIVE' };
    }

    if (round.endTime && new Date() > new Date(round.endTime)) {
      throw { statusCode: 400, message: 'Round 3 deadline has passed' };
    }

    const progress = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );

    if (progress && progress.status === 'LOCKED') {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    if (progress && progress.status === 'SUBMITTED') {
      throw { statusCode: 400, message: 'Cannot modify code: Round 3 has been submitted' };
    }

    const currentMap = (progress?.stateData as any)?.savedCodeMap || {};
    const updatedMap = { ...currentMap, [language]: code };

    const updatedProgress = await queryOne<DbRoundProgress>(
      `INSERT INTO round_progress (id, "studentId", "roundId", status, "startedAt", "lastSavedAt", "stateData")
       VALUES (gen_random_uuid(), $1, $2, 'IN_PROGRESS', NOW(), NOW(), $3)
       ON CONFLICT ("studentId", "roundId")
       DO UPDATE SET status = 'IN_PROGRESS', "lastSavedAt" = NOW(), "stateData" = $3
       RETURNING *`,
      [studentId, roundId, JSON.stringify({ savedCodeMap: updatedMap })]
    );

    return { status: 'success', lastSavedAt: updatedProgress!.lastSavedAt };
  }

  public async runStudentCode(roundId: string, studentId: string, problemId: string, languageStr: string, code: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);

    if (!round || round.status !== 'LIVE') {
      throw { statusCode: 400, message: 'Cannot run code: Round 3 is not LIVE' };
    }

    if (round.endTime && new Date() > new Date(round.endTime)) {
      throw { statusCode: 400, message: 'Round 3 deadline has passed' };
    }

    const progressRun = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );
    if (progressRun && progressRun.status === 'LOCKED') {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    const problem = await queryOne<DbProgrammingProblem>(`SELECT * FROM programming_problems WHERE id = $1`, [problemId]);

    if (!problem) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    const langKey = languageStr.toUpperCase() as ProgrammingLanguage;
    if (!problem.supportedLanguages.includes(languageStr) && !problem.supportedLanguages.includes(langKey)) {
      throw { statusCode: 400, message: `Language ${languageStr} is not allowed for this problem. Allowed: ${problem.supportedLanguages.join(', ')}` };
    }

    const testCases = await query<DbTestCase>(
      `SELECT * FROM test_cases WHERE "programmingProblemId" = $1 AND "isActive" = true AND visibility = 'VISIBLE' ORDER BY "order" ASC`,
      [problemId]
    );

    const testCaseInputs: TestCaseInput[] = testCases.map((tc) => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      marks: tc.marks,
      visibility: TestCaseVisibility.VISIBLE,
    }));

    const executionResult = await codeExecutionService.runCode({
      language: langKey,
      sourceCode: code,
      testCases: testCaseInputs,
      timeLimitMs: problem.timeLimit,
    });

    return {
      compileStatus: executionResult.compileStatus,
      compileOutput: executionResult.compileOutput || '',
      visibleTestResults: executionResult.testResults,
      totalPassedTests: executionResult.totalPassedTests,
      totalTests: executionResult.totalTests,
      status: executionResult.submissionStatus,
      executionTimeMs: executionResult.totalExecutionTimeMs,
    };
  }

  public async submitStudentCode(roundId: string, studentId: string, problemId: string, languageStr: string, code: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);

    if (!round || round.status !== 'LIVE') {
      throw { statusCode: 400, message: 'Cannot submit code: Round 3 is not LIVE' };
    }

    if (round.endTime && new Date() > new Date(round.endTime)) {
      throw { statusCode: 400, message: 'Round 3 deadline has passed' };
    }

    const progressSub = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );
    if (progressSub && progressSub.status === 'LOCKED') {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    const problem = await queryOne<DbProgrammingProblem>(`SELECT * FROM programming_problems WHERE id = $1`, [problemId]);

    if (!problem) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    const langKey = languageStr.toUpperCase() as ProgrammingLanguage;
    if (!problem.supportedLanguages.includes(languageStr) && !problem.supportedLanguages.includes(langKey)) {
      throw { statusCode: 400, message: `Language ${languageStr} is not allowed for this problem. Allowed: ${problem.supportedLanguages.join(', ')}` };
    }

    const testCases = await query<DbTestCase>(
      `SELECT * FROM test_cases WHERE "programmingProblemId" = $1 AND "isActive" = true ORDER BY "order" ASC`,
      [problemId]
    );

    const testCaseInputs: TestCaseInput[] = testCases.map((tc) => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      marks: tc.marks,
      visibility: tc.visibility,
    }));

    const executionResult = await codeExecutionService.submitCode({
      language: langKey,
      sourceCode: code,
      testCases: testCaseInputs,
      timeLimitMs: problem.timeLimit,
    });

    const sanitizedTestResults = executionResult.testResults.map((tr) => {
      if (tr.visibility === TestCaseVisibility.HIDDEN) {
        return {
          testCaseId: tr.testCaseId,
          status: tr.status,
          visibility: tr.visibility,
          executionTimeMs: tr.executionTimeMs,
          marksAwarded: tr.marksAwarded,
        };
      }
      return tr;
    });

    return await transaction(async (client) => {
      const subCountRes = await txQueryOne<{ count: string }>(client,
        `SELECT COUNT(*) FROM programming_submissions WHERE "studentId" = $1 AND "programmingProblemId" = $2`,
        [studentId, problemId]
      );
      const subCount = parseInt(subCountRes?.count || '0', 10);

      const submission = await txQueryOne<DbProgrammingSubmission>(client,
        `INSERT INTO programming_submissions (id, "studentId", "programmingProblemId", language, "submittedCode", "submissionNumber", "compileStatus", "compileOutput", "executionOutput", "passedTests", "totalTests", score, "executionTime", "submissionStatus", "submittedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         RETURNING *`,
        [
          studentId,
          problemId,
          langKey,
          code,
          subCount + 1,
          executionResult.compileStatus,
          executionResult.compileOutput || '',
          executionResult.testResults[0]?.actualOutput || '',
          executionResult.totalPassedTests,
          executionResult.totalTests,
          executionResult.score,
          executionResult.totalExecutionTimeMs,
          executionResult.submissionStatus,
        ]
      );

      const existingScore = await txQueryOne<DbRoundScore>(client,
        `SELECT * FROM round_scores WHERE "studentId" = $1 AND "roundId" = $2`,
        [studentId, roundId]
      );

      const finalScore = existingScore ? Math.max(existingScore.score, executionResult.score) : executionResult.score;

      await txExecute(client,
        `INSERT INTO round_scores (id, "studentId", "roundId", score, "maximumScore", "calculatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
         ON CONFLICT ("studentId", "roundId")
         DO UPDATE SET score = $3, "maximumScore" = $4, "calculatedAt" = NOW()`,
        [studentId, roundId, finalScore, problem.maximumMarks]
      );

      await txExecute(client,
        `INSERT INTO round_progress (id, "studentId", "roundId", status, "lastSavedAt")
         VALUES (gen_random_uuid(), $1, $2, 'IN_PROGRESS', NOW())
         ON CONFLICT ("studentId", "roundId")
         DO UPDATE SET status = 'IN_PROGRESS', "lastSavedAt" = NOW()`,
        [studentId, roundId]
      );

      return {
        status: 'success',
        submissionId: submission!.id,
        submissionNumber: submission!.submissionNumber,
        compileStatus: submission!.compileStatus,
        compileOutput: submission!.compileOutput,
        submissionStatus: submission!.submissionStatus,
        passedTests: submission!.passedTests,
        totalTests: submission!.totalTests,
        score: submission!.score,
        maximumScore: problem.maximumMarks,
        testResults: sanitizedTestResults,
      };
    });
  }

  // ==========================================
  // ADMIN INSPECTION & LEADERBOARD
  // ==========================================

  public async getAdminSubmissions(problemId: string, studentId?: string) {
    const conditions: string[] = [`"programmingProblemId" = $1`];
    const params: any[] = [problemId];

    if (studentId) {
      params.push(studentId);
      conditions.push(`"studentId" = $${params.length}`);
    }

    const submissions = await query<DbProgrammingSubmission & { student_studentId: string; student_fullName: string; student_batchNumber: string }>(
      `SELECT ps.*, s."studentId" as "student_studentId", s."fullName" as "student_fullName", s."batchNumber" as "student_batchNumber"
       FROM programming_submissions ps
       JOIN students s ON s.id = ps."studentId"
       WHERE ${conditions.join(' AND ')}
       ORDER BY ps."submittedAt" DESC`,
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

  public async getRound3Scores(roundId: string) {
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

        return {
          id: s.id,
          studentId: s.studentId,
          fullName: s.fullName,
          batchNumber: s.batchNumber,
          status: progress ? progress.status : 'NOT_STARTED',
          score: score ? score.score : 0,
          maximumScore: score ? score.maximumScore : 0,
          submittedAt: progress ? progress.submittedAt : null,
        };
      })
    );
  }
}

export const round3Service = new Round3Service();
