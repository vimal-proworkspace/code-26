import { RoundStatus, RoundProgressStatus, ProgrammingLanguage, TestCaseVisibility } from '@prisma/client';
import { prisma } from '../config/database';
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
      await prisma.auditLog.create({
        data: {
          action,
          entity: 'ProgrammingProblem',
          entityId,
          userId,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        },
      });
    } catch (err) {
      console.error('Failed to log audit for Round 3:', err);
    }
  }

  // ==========================================
  // ADMIN PROBLEM & TEST CASE MANAGEMENT
  // ==========================================

  public async getAdminProblems(roundId: string) {
    return prisma.programmingProblem.findMany({
      where: { roundId },
      orderBy: { createdAt: 'asc' },
      include: {
        testCases: { orderBy: { order: 'asc' } },
        _count: { select: { submissions: true } },
      },
    });
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

    const problem = await prisma.programmingProblem.create({
      data: {
        roundId,
        title,
        description,
        inputFormat: input.inputFormat || null,
        outputFormat: input.outputFormat || null,
        constraints: input.constraints || null,
        examples: input.examples ? JSON.parse(JSON.stringify(input.examples)) : undefined,
        starterCode: input.starterCode || null,
        supportedLanguages: defaultLanguages,
        maximumMarks: input.maximumMarks ?? 100,
        timeLimit: input.timeLimit ?? 2000,
        memoryLimit: input.memoryLimit ?? 256000,
        isActive: input.isActive ?? true,
      },
    });

    await this.logAudit('ROUND3_PROBLEM_CREATED', problem.id, userId, { title });
    return problem;
  }

  public async updateProgrammingProblem(problemId: string, input: UpdateProgrammingProblemInput, userId?: string) {
    const existing = await prisma.programmingProblem.findUnique({ where: { id: problemId } });
    if (!existing) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    const problem = await prisma.programmingProblem.update({
      where: { id: problemId },
      data: {
        title: input.title !== undefined ? input.title.trim() : existing.title,
        description: input.description !== undefined ? input.description.trim() : existing.description,
        inputFormat: input.inputFormat !== undefined ? input.inputFormat : existing.inputFormat,
        outputFormat: input.outputFormat !== undefined ? input.outputFormat : existing.outputFormat,
        constraints: input.constraints !== undefined ? input.constraints : existing.constraints,
        examples: input.examples !== undefined ? JSON.parse(JSON.stringify(input.examples)) : existing.examples,
        starterCode: input.starterCode !== undefined ? input.starterCode : existing.starterCode,
        supportedLanguages: input.supportedLanguages !== undefined ? input.supportedLanguages : existing.supportedLanguages,
        maximumMarks: input.maximumMarks !== undefined ? input.maximumMarks : existing.maximumMarks,
        timeLimit: input.timeLimit !== undefined ? input.timeLimit : existing.timeLimit,
        memoryLimit: input.memoryLimit !== undefined ? input.memoryLimit : existing.memoryLimit,
        isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      },
    });

    await this.logAudit('ROUND3_PROBLEM_UPDATED', problem.id, userId, { title: problem.title });
    return problem;
  }

  public async deleteProgrammingProblem(problemId: string, userId?: string) {
    const existing = await prisma.programmingProblem.findUnique({ where: { id: problemId } });
    if (!existing) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    await prisma.programmingProblem.delete({ where: { id: problemId } });
    await this.logAudit('ROUND3_PROBLEM_DELETED', problemId, userId, { title: existing.title });
    return { status: 'success', message: 'Programming problem deleted' };
  }

  public async createTestCase(problemId: string, input: CreateTestCaseInput, userId?: string) {
    const problem = await prisma.programmingProblem.findUnique({ where: { id: problemId } });
    if (!problem) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    const testCaseCount = await prisma.testCase.count({ where: { programmingProblemId: problemId } });

    const testCase = await prisma.testCase.create({
      data: {
        programmingProblemId: problemId,
        input: input.input || '',
        expectedOutput: input.expectedOutput || '',
        marks: input.marks ?? 10,
        visibility: input.visibility || TestCaseVisibility.VISIBLE,
        order: input.order ?? testCaseCount + 1,
        isActive: input.isActive ?? true,
      },
    });

    await this.logAudit('TEST_CASE_CREATED', testCase.id, userId, { problemId, visibility: testCase.visibility });
    return testCase;
  }

  public async updateTestCase(testCaseId: string, input: UpdateTestCaseInput, userId?: string) {
    const existing = await prisma.testCase.findUnique({ where: { id: testCaseId } });
    if (!existing) {
      throw { statusCode: 404, message: 'Test case not found' };
    }

    const testCase = await prisma.testCase.update({
      where: { id: testCaseId },
      data: {
        input: input.input !== undefined ? input.input : existing.input,
        expectedOutput: input.expectedOutput !== undefined ? input.expectedOutput : existing.expectedOutput,
        marks: input.marks !== undefined ? input.marks : existing.marks,
        visibility: input.visibility !== undefined ? input.visibility : existing.visibility,
        order: input.order !== undefined ? input.order : existing.order,
        isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      },
    });

    await this.logAudit('TEST_CASE_UPDATED', testCase.id, userId, { testCaseId });
    return testCase;
  }

  public async deleteTestCase(testCaseId: string, userId?: string) {
    const existing = await prisma.testCase.findUnique({ where: { id: testCaseId } });
    if (!existing) {
      throw { statusCode: 404, message: 'Test case not found' };
    }

    await prisma.testCase.delete({ where: { id: testCaseId } });
    await this.logAudit('TEST_CASE_DELETED', testCaseId, userId, { testCaseId });
    return { status: 'success', message: 'Test case deleted' };
  }

  // ==========================================
  // STUDENT WORKSPACE & EXECUTION
  // ==========================================

  /**
   * Retrieves active Round 3 Problem for student workspace.
   * SECURITY: Strictly hides hidden test case inputs, expected outputs, and solution keys!
   */
  public async getStudentRound3(roundId: string, studentId: string) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });

    if (!round) {
      throw { statusCode: 404, message: 'Round 3 not found' };
    }

    if (round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: `Round 3 is currently ${round.status}. Accessible only when LIVE.` };
    }

    // Check submission status
    const progress = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });

    const isSubmitted = progress?.status === RoundProgressStatus.SUBMITTED;

    const problem = await prisma.programmingProblem.findFirst({
      where: { roundId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: {
        testCases: {
          where: { isActive: true, visibility: TestCaseVisibility.VISIBLE },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            input: true,
            expectedOutput: true,
            marks: true,
            order: true,
          },
        },
      },
    });

    if (!problem) {
      throw { statusCode: 404, message: 'No active programming problem found for Round 3' };
    }

    // Calculate server remaining seconds
    const now = Date.now();
    const endTimeMs = round.endTime ? round.endTime.getTime() : now;
    const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));

    // Restore saved code dictionary per language
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
        visibleTestCases: problem.testCases, // ONLY VISIBLE TEST CASES RETURNED!
        savedCodeMap,
      },
    };
  }

  /**
   * Saves student code per language to RoundProgress.stateData
   */
  public async saveStudentCode(roundId: string, studentId: string, language: string, code: string) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });

    if (!round || round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: 'Cannot save code: Round 3 is not LIVE' };
    }

    if (round.endTime && new Date() > round.endTime) {
      throw { statusCode: 400, message: 'Round 3 deadline has passed' };
    }

    const progress = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });

    if (progress && progress.status === RoundProgressStatus.LOCKED) {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    if (progress && progress.status === RoundProgressStatus.SUBMITTED) {
      throw { statusCode: 400, message: 'Cannot modify code: Round 3 has been submitted' };
    }

    const currentMap = (progress?.stateData as any)?.savedCodeMap || {};
    const updatedMap = { ...currentMap, [language]: code };

    const updatedProgress = await prisma.roundProgress.upsert({
      where: { studentId_roundId: { studentId, roundId } },
      create: {
        studentId,
        roundId,
        status: RoundProgressStatus.IN_PROGRESS,
        startedAt: new Date(),
        lastSavedAt: new Date(),
        stateData: { savedCodeMap: updatedMap },
      },
      update: {
        status: RoundProgressStatus.IN_PROGRESS,
        lastSavedAt: new Date(),
        stateData: { savedCodeMap: updatedMap },
      },
    });

    return { status: 'success', lastSavedAt: updatedProgress.lastSavedAt };
  }

  /**
   * Runs student code against ONLY VISIBLE test cases for practice. Does NOT reveal hidden test cases.
   */
  public async runStudentCode(roundId: string, studentId: string, problemId: string, languageStr: string, code: string) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });

    if (!round || round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: 'Cannot run code: Round 3 is not LIVE' };
    }

    if (round.endTime && new Date() > round.endTime) {
      throw { statusCode: 400, message: 'Round 3 deadline has passed' };
    }

    const progressRun = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });
    if (progressRun && progressRun.status === RoundProgressStatus.LOCKED) {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    const problem = await prisma.programmingProblem.findUnique({
      where: { id: problemId },
      include: {
        testCases: { where: { isActive: true, visibility: TestCaseVisibility.VISIBLE }, orderBy: { order: 'asc' } },
      },
    });

    if (!problem) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    // STRICT LANGUAGE ENFORCEMENT
    const langKey = languageStr.toUpperCase() as ProgrammingLanguage;
    if (!problem.supportedLanguages.includes(languageStr) && !problem.supportedLanguages.includes(langKey)) {
      throw { statusCode: 400, message: `Language ${languageStr} is not allowed for this problem. Allowed: ${problem.supportedLanguages.join(', ')}` };
    }

    const testCaseInputs: TestCaseInput[] = problem.testCases.map((tc) => ({
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

  /**
   * Official submission of student code for Round 3.
   * Executes against ALL (VISIBLE + HIDDEN) test cases, calculates score, persists ProgrammingSubmission and RoundScore inside a transaction.
   */
  public async submitStudentCode(roundId: string, studentId: string, problemId: string, languageStr: string, code: string) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });

    if (!round || round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: 'Cannot submit code: Round 3 is not LIVE' };
    }

    if (round.endTime && new Date() > round.endTime) {
      throw { statusCode: 400, message: 'Round 3 deadline has passed' };
    }

    const progressSub = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });
    if (progressSub && progressSub.status === RoundProgressStatus.LOCKED) {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    const problem = await prisma.programmingProblem.findUnique({
      where: { id: problemId },
      include: {
        testCases: { where: { isActive: true }, orderBy: { order: 'asc' } },
      },
    });

    if (!problem) {
      throw { statusCode: 404, message: 'Programming problem not found' };
    }

    // STRICT LANGUAGE ENFORCEMENT
    const langKey = languageStr.toUpperCase() as ProgrammingLanguage;
    if (!problem.supportedLanguages.includes(languageStr) && !problem.supportedLanguages.includes(langKey)) {
      throw { statusCode: 400, message: `Language ${languageStr} is not allowed for this problem. Allowed: ${problem.supportedLanguages.join(', ')}` };
    }

    const testCaseInputs: TestCaseInput[] = problem.testCases.map((tc) => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      marks: tc.marks,
      visibility: tc.visibility,
    }));

    // Execute code against ALL test cases
    const executionResult = await codeExecutionService.submitCode({
      language: langKey,
      sourceCode: code,
      testCases: testCaseInputs,
      timeLimitMs: problem.timeLimit,
    });

    // SANITIZE TEST RESULTS FOR STUDENT RESPONSE: Hide hidden test input & expected output!
    const sanitizedTestResults = executionResult.testResults.map((tr) => {
      if (tr.visibility === TestCaseVisibility.HIDDEN) {
        return {
          testCaseId: tr.testCaseId,
          status: tr.status,
          visibility: tr.visibility,
          executionTimeMs: tr.executionTimeMs,
          marksAwarded: tr.marksAwarded,
          // input and expectedOutput intentionally OMITTED!
        };
      }
      return tr;
    });

    return await prisma.$transaction(async (tx) => {
      const subCount = await tx.programmingSubmission.count({
        where: { studentId, programmingProblemId: problemId },
      });

      const submission = await tx.programmingSubmission.create({
        data: {
          studentId,
          programmingProblemId: problemId,
          language: langKey,
          submittedCode: code,
          submissionNumber: subCount + 1,
          compileStatus: executionResult.compileStatus,
          compileOutput: executionResult.compileOutput || '',
          executionOutput: executionResult.testResults[0]?.actualOutput || '',
          passedTests: executionResult.totalPassedTests,
          totalTests: executionResult.totalTests,
          score: executionResult.score,
          executionTime: executionResult.totalExecutionTimeMs,
          submissionStatus: executionResult.submissionStatus,
        },
      });

      // Fetch highest score for this student in Round 3 to maintain best/latest score
      const existingScore = await tx.roundScore.findUnique({
        where: { studentId_roundId: { studentId, roundId } },
      });

      const finalScore = existingScore ? Math.max(existingScore.score, executionResult.score) : executionResult.score;

      await tx.roundScore.upsert({
        where: { studentId_roundId: { studentId, roundId } },
        create: {
          studentId,
          roundId,
          score: finalScore,
          maximumScore: problem.maximumMarks,
          calculatedAt: new Date(),
        },
        update: {
          score: finalScore,
          maximumScore: problem.maximumMarks,
          calculatedAt: new Date(),
        },
      });

      await tx.roundProgress.upsert({
        where: { studentId_roundId: { studentId, roundId } },
        create: {
          studentId,
          roundId,
          status: RoundProgressStatus.IN_PROGRESS,
          lastSavedAt: new Date(),
        },
        update: {
          status: RoundProgressStatus.IN_PROGRESS,
          lastSavedAt: new Date(),
        },
      });

      return {
        status: 'success',
        submissionId: submission.id,
        submissionNumber: submission.submissionNumber,
        compileStatus: submission.compileStatus,
        compileOutput: submission.compileOutput,
        submissionStatus: submission.submissionStatus,
        passedTests: submission.passedTests,
        totalTests: submission.totalTests,
        score: submission.score,
        maximumScore: problem.maximumMarks,
        testResults: sanitizedTestResults,
      };
    });
  }

  // ==========================================
  // ADMIN INSPECTION & LEADERBOARD
  // ==========================================

  public async getAdminSubmissions(problemId: string, studentId?: string) {
    const whereClause: any = { programmingProblemId: problemId };
    if (studentId) {
      whereClause.studentId = studentId;
    }

    return prisma.programmingSubmission.findMany({
      where: whereClause,
      orderBy: { submittedAt: 'desc' },
      include: {
        student: { select: { id: true, studentId: true, fullName: true, batchNumber: true } },
      },
    });
  }

  public async getRound3Scores(roundId: string) {
    const students = await prisma.student.findMany({
      orderBy: { studentId: 'asc' },
      include: {
        scores: { where: { roundId } },
        progresses: { where: { roundId } },
      },
    });

    return students.map((s) => {
      const score = s.scores[0];
      const progress = s.progresses[0];

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
    });
  }
}

export const round3Service = new Round3Service();
