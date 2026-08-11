import { RoundStatus, RoundProgressStatus, QuestionType, ProgrammingLanguage } from '@prisma/client';
import { prisma } from '../config/database';
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
  /**
   * Helper audit logger
   */
  private async logAudit(action: string, entityId: string, userId?: string, metadata?: Record<string, unknown>) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity: 'DebuggingProblem',
          entityId,
          userId,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        },
      });
    } catch (err) {
      console.error('Failed to log audit for Round 2:', err);
    }
  }

  // ==========================================
  // ADMIN PROBLEM & BUG MANAGEMENT
  // ==========================================

  public async getAdminProblems(roundId: string) {
    return prisma.debuggingProblem.findMany({
      where: { roundId },
      orderBy: { createdAt: 'asc' },
      include: {
        bugDefinitions: { orderBy: { order: 'asc' } },
        _count: { select: { submissions: true } },
      },
    });
  }

  public async createDebuggingProblem(roundId: string, input: CreateDebuggingProblemInput, userId?: string) {
    const title = (input.title || '').trim();
    const description = (input.description || '').trim();
    const buggyCode = input.buggyCode || '';

    if (!title || !description || !buggyCode) {
      throw { statusCode: 400, message: 'Title, description, and buggy C code are required' };
    }

    const problem = await prisma.debuggingProblem.create({
      data: {
        roundId,
        title,
        description,
        buggyCode,
        solutionCode: input.solutionCode || null,
        starterCode: input.starterCode || buggyCode,
        maximumMarks: input.maximumMarks ?? 10,
        timeLimit: input.timeLimit ?? 2000,
        memoryLimit: input.memoryLimit ?? 128000,
        isActive: input.isActive ?? true,
      },
    });

    await this.logAudit('ROUND2_PROBLEM_CREATED', problem.id, userId, { title });
    return problem;
  }

  public async updateDebuggingProblem(problemId: string, input: UpdateDebuggingProblemInput, userId?: string) {
    const existing = await prisma.debuggingProblem.findUnique({ where: { id: problemId } });
    if (!existing) {
      throw { statusCode: 404, message: 'Debugging problem not found' };
    }

    const problem = await prisma.debuggingProblem.update({
      where: { id: problemId },
      data: {
        title: input.title !== undefined ? input.title.trim() : existing.title,
        description: input.description !== undefined ? input.description.trim() : existing.description,
        buggyCode: input.buggyCode !== undefined ? input.buggyCode : existing.buggyCode,
        solutionCode: input.solutionCode !== undefined ? input.solutionCode : existing.solutionCode,
        starterCode: input.starterCode !== undefined ? input.starterCode : existing.starterCode,
        maximumMarks: input.maximumMarks !== undefined ? input.maximumMarks : existing.maximumMarks,
        timeLimit: input.timeLimit !== undefined ? input.timeLimit : existing.timeLimit,
        memoryLimit: input.memoryLimit !== undefined ? input.memoryLimit : existing.memoryLimit,
        isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      },
    });

    await this.logAudit('ROUND2_PROBLEM_UPDATED', problem.id, userId, { title: problem.title });
    return problem;
  }

  public async deleteDebuggingProblem(problemId: string, userId?: string) {
    const existing = await prisma.debuggingProblem.findUnique({ where: { id: problemId } });
    if (!existing) {
      throw { statusCode: 404, message: 'Debugging problem not found' };
    }

    await prisma.debuggingProblem.delete({ where: { id: problemId } });
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

    const problem = await prisma.debuggingProblem.findUnique({ where: { id: problemId } });
    if (!problem) {
      throw { statusCode: 404, message: 'Debugging problem not found' };
    }

    const bugCount = await prisma.bugDefinition.count({ where: { debuggingProblemId: problemId } });

    const bug = await prisma.bugDefinition.create({
      data: {
        debuggingProblemId: problemId,
        bugId,
        title,
        description: input.description || null,
        marks: input.marks,
        validationConfig: input.validationConfig ? JSON.parse(JSON.stringify(input.validationConfig)) : {},
        order: input.order ?? bugCount + 1,
        isActive: input.isActive ?? true,
      },
    });

    await this.logAudit('BUG_DEFINITION_CREATED', bug.id, userId, { bugId, problemId });
    return bug;
  }

  public async updateBugDefinition(bugDefinitionId: string, input: UpdateBugDefinitionInput, userId?: string) {
    const existing = await prisma.bugDefinition.findUnique({ where: { id: bugDefinitionId } });
    if (!existing) {
      throw { statusCode: 404, message: 'Bug definition not found' };
    }

    const bug = await prisma.bugDefinition.update({
      where: { id: bugDefinitionId },
      data: {
        bugId: input.bugId !== undefined ? input.bugId.trim() : existing.bugId,
        title: input.title !== undefined ? input.title.trim() : existing.title,
        description: input.description !== undefined ? input.description : existing.description,
        marks: input.marks !== undefined ? input.marks : existing.marks,
        validationConfig: input.validationConfig !== undefined ? input.validationConfig : existing.validationConfig,
        order: input.order !== undefined ? input.order : existing.order,
        isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      },
    });

    await this.logAudit('BUG_DEFINITION_UPDATED', bug.id, userId, { bugId: bug.bugId });
    return bug;
  }

  public async deleteBugDefinition(bugDefinitionId: string, userId?: string) {
    const existing = await prisma.bugDefinition.findUnique({ where: { id: bugDefinitionId } });
    if (!existing) {
      throw { statusCode: 404, message: 'Bug definition not found' };
    }

    await prisma.bugDefinition.delete({ where: { id: bugDefinitionId } });
    await this.logAudit('BUG_DEFINITION_DELETED', bugDefinitionId, userId, { bugId: existing.bugId });
    return { status: 'success', message: 'Bug definition deleted' };
  }

  // ==========================================
  // STUDENT WORKSPACE & EXECUTION
  // ==========================================

  /**
   * Retrieves active Round 2 Debugging Problem for student workspace.
   * Strips all hidden validation configurations and solution code!
   */
  public async getStudentRound2(roundId: string, studentId: string) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });

    if (!round) {
      throw { statusCode: 404, message: 'Round 2 not found' };
    }

    if (round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: `Round 2 is currently ${round.status}. Accessible only when LIVE.` };
    }

    // Check submission status
    const progress = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });

    const isSubmitted = progress?.status === RoundProgressStatus.SUBMITTED;

    const problem = await prisma.debuggingProblem.findFirst({
      where: { roundId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!problem) {
      throw { statusCode: 404, message: 'No active debugging problem found for Round 2' };
    }

    // Calculate server remaining seconds
    const now = Date.now();
    const endTimeMs = round.endTime ? round.endTime.getTime() : now;
    const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));

    // Restore student saved code if any
    let savedCode = problem.buggyCode;
    if (progress?.stateData && typeof progress.stateData === 'object') {
      const data = progress.stateData as Record<string, any>;
      if (typeof data.code === 'string' && data.code.length > 0) {
        savedCode = data.code;
      }
    }

    // SANITIZE: DO NOT return solutionCode, or bug definitions/marks/validationConfig!
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

  /**
   * Saves student code to RoundProgress.stateData
   */
  public async saveStudentCode(roundId: string, studentId: string, code: string) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });

    if (!round || round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: 'Cannot save code: Round 2 is not LIVE' };
    }

    if (round.endTime && new Date() > round.endTime) {
      throw { statusCode: 400, message: 'Round 2 deadline has passed' };
    }

    const progress = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });

    if (progress && progress.status === RoundProgressStatus.LOCKED) {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    if (progress && progress.status === RoundProgressStatus.SUBMITTED) {
      throw { statusCode: 400, message: 'Cannot modify code: Round 2 has been submitted' };
    }

    const updatedProgress = await prisma.roundProgress.upsert({
      where: { studentId_roundId: { studentId, roundId } },
      create: {
        studentId,
        roundId,
        status: RoundProgressStatus.IN_PROGRESS,
        startedAt: new Date(),
        lastSavedAt: new Date(),
        stateData: { code },
      },
      update: {
        status: RoundProgressStatus.IN_PROGRESS,
        lastSavedAt: new Date(),
        stateData: { code },
      },
    });

    return { status: 'success', lastSavedAt: updatedProgress.lastSavedAt };
  }

  /**
   * Runs C code against a sample test case without awarding marks or submitting.
   */
  public async runStudentCode(roundId: string, studentId: string, problemId: string, code: string, inputStr: string = '') {
    const round = await prisma.round.findUnique({ where: { id: roundId } });

    if (!round || round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: 'Cannot run code: Round 2 is not LIVE' };
    }

    if (round.endTime && new Date() > round.endTime) {
      throw { statusCode: 400, message: 'Round 2 deadline has passed' };
    }

    const progressRun = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });
    if (progressRun && progressRun.status === RoundProgressStatus.LOCKED) {
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

  /**
   * Submits student code for Round 2, executes against deterministic bug validation criteria,
   * awards un-awarded bug points, and records DebuggingSubmission and RoundScore safely in a transaction.
   */
  public async submitStudentCode(roundId: string, studentId: string, problemId: string, code: string) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });

    if (!round || round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: 'Cannot submit code: Round 2 is not LIVE' };
    }

    if (round.endTime && new Date() > round.endTime) {
      throw { statusCode: 400, message: 'Round 2 deadline has passed' };
    }

    const progressSub = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });
    if (progressSub && progressSub.status === RoundProgressStatus.LOCKED) {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    const problem = await prisma.debuggingProblem.findUnique({
      where: { id: problemId },
      include: { bugDefinitions: { where: { isActive: true }, orderBy: { order: 'asc' } } },
    });

    if (!problem) {
      throw { statusCode: 404, message: 'Debugging problem not found' };
    }

    // 1. First, compile the C code
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

    // 2. Validate bugs deterministically
    const newlyFixedBugIds: string[] = [];
    let compilationFailed = compileStatus === 'COMPILATION_ERROR';

    if (!compilationFailed) {
      for (const bugDef of problem.bugDefinitions) {
        const isFixed = await this.validateBug(code, bugDef.validationConfig);
        if (isFixed) {
          newlyFixedBugIds.push(bugDef.id);
        }
      }
    }

    // 3. Process awards and save submission atomically inside prisma.$transaction
    return await prisma.$transaction(async (tx) => {
      // Find current submission count for this student
      const subCount = await tx.debuggingSubmission.count({
        where: { studentId, debuggingProblemId: problemId },
      });

      // Find existing bug awards for this student
      const existingAwards = await tx.bugAward.findMany({
        where: { studentId, bugDefinitionId: { in: problem.bugDefinitions.map((b) => b.id) } },
      });

      const awardedBugDefIds = new Set(existingAwards.map((a) => a.bugDefinitionId));

      // Filter only bugs that have NOT been awarded yet
      const bugsToAward = problem.bugDefinitions.filter((b) => newlyFixedBugIds.includes(b.id) && !awardedBugDefIds.has(b.id));

      let newScorePoints = 0;

      // Create DebuggingSubmission record
      const submission = await tx.debuggingSubmission.create({
        data: {
          studentId,
          debuggingProblemId: problemId,
          submittedCode: code,
          submissionNumber: subCount + 1,
          compileStatus: compileStatus,
          compileOutput: compileOutput,
          executionOutput: compileCheck.testResults[0]?.actualOutput || '',
          executionTime: compileCheck.totalExecutionTimeMs,
          score: 0, // Will update below
        },
      });

      // Award newly fixed bugs safely
      for (const bug of bugsToAward) {
        try {
          await tx.bugAward.create({
            data: {
              studentId,
              bugDefinitionId: bug.id,
              debuggingSubmissionId: submission.id,
              marksAwarded: bug.marks,
            },
          });
          newScorePoints += bug.marks;
        } catch (err: any) {
          // Handle potential concurrency duplicate constraint gracefully
          console.warn(`Bug award concurrency skipped for bug ${bug.id}:`, err?.message);
        }
      }

      // Calculate overall Round 2 score across all awarded bugs
      const allStudentAwards = await tx.bugAward.findMany({
        where: { studentId, bugDefinition: { debuggingProblemId: problemId } },
      });

      const totalScore = allStudentAwards.reduce((sum, a) => sum + a.marksAwarded, 0);

      // Update submission score
      await tx.debuggingSubmission.update({
        where: { id: submission.id },
        data: { score: totalScore },
      });

      // Upsert RoundScore for Round 2
      await tx.roundScore.upsert({
        where: { studentId_roundId: { studentId, roundId } },
        create: {
          studentId,
          roundId,
          score: totalScore,
          maximumScore: problem.maximumMarks,
          calculatedAt: new Date(),
        },
        update: {
          score: totalScore,
          maximumScore: problem.maximumMarks,
          calculatedAt: new Date(),
        },
      });

      // Update RoundProgress
      await tx.roundProgress.upsert({
        where: { studentId_roundId: { studentId, roundId } },
        create: {
          studentId,
          roundId,
          status: RoundProgressStatus.IN_PROGRESS,
          lastSavedAt: new Date(),
          stateData: { code },
        },
        update: {
          status: RoundProgressStatus.IN_PROGRESS,
          lastSavedAt: new Date(),
          stateData: { code },
        },
      });

      return {
        status: 'success',
        submissionId: submission.id,
        submissionNumber: submission.submissionNumber,
        compileStatus: submission.compileStatus,
        compileOutput: submission.compileOutput,
        executionOutput: submission.executionOutput,
        newlyFixedBugsCount: bugsToAward.length,
        totalFixedBugsCount: allStudentAwards.length,
        newScorePoints,
        totalScore,
        maximumScore: problem.maximumMarks,
      };
    });
  }

  /**
   * Deterministic Bug Validation Engine.
   * Validates submitted source code against bug criteria defined in validationConfig.
   */
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

    // 1. Source code pattern checks
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

    // 2. Test case execution check (if expectedOutput is configured)
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
        // TRIM
        return actual === expected;
      }
    }

    return true;
  }

  // ==========================================
  // ADMIN INSPECTION & LEADERBOARD
  // ==========================================

  public async getAdminSubmissions(problemId: string, studentId?: string) {
    const whereClause: any = { debuggingProblemId: problemId };
    if (studentId) {
      whereClause.studentId = studentId;
    }

    return prisma.debuggingSubmission.findMany({
      where: whereClause,
      orderBy: { submittedAt: 'desc' },
      include: {
        student: { select: { id: true, studentId: true, fullName: true, batchNumber: true } },
      },
    });
  }

  public async getRound2Scores(roundId: string) {
    const students = await prisma.student.findMany({
      orderBy: { studentId: 'asc' },
      include: {
        scores: { where: { roundId } },
        progresses: { where: { roundId } },
        bugAwards: { include: { bugDefinition: true } },
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
        fixedBugsCount: s.bugAwards.length,
        submittedAt: progress ? progress.submittedAt : null,
      };
    });
  }
}

export const round2Service = new Round2Service();
