import { QuestionType, ComparisonMethod, RoundStatus, RoundProgressStatus } from '@prisma/client';
import { prisma } from '../config/database';

export interface CreateOptionInput {
  optionKey: string;
  optionText: string;
  order: number;
}

export interface CreateQuestionInput {
  questionText: string;
  questionType: QuestionType;
  marks: number;
  negativeMarks?: number;
  order?: number;
  isActive?: boolean;
  correctAnswer?: string;
  code?: string;
  correctOutput?: string;
  comparisonMethod?: ComparisonMethod;
  options?: CreateOptionInput[];
}

export interface UpdateQuestionInput {
  questionText?: string;
  questionType?: QuestionType;
  marks?: number;
  negativeMarks?: number;
  order?: number;
  isActive?: boolean;
  correctAnswer?: string;
  code?: string;
  correctOutput?: string;
  comparisonMethod?: ComparisonMethod;
  options?: CreateOptionInput[];
}

export class Round1Service {
  /**
   * Writes audit log entries safely.
   */
  private async logAudit(action: string, entityId: string, userId?: string, metadata?: Record<string, unknown>) {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity: 'Question',
          entityId,
          userId,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        },
      });
    } catch (err) {
      console.error('Failed to create Round 1 audit log:', err);
    }
  }

  // ==========================================
  // ADMIN QUESTION MANAGEMENT
  // ==========================================

  /**
   * Retrieves all questions for Round 1 (Admin view with correct answers & options).
   */
  public async getAdminQuestions(roundId: string) {
    return prisma.question.findMany({
      where: { roundId },
      orderBy: { order: 'asc' },
      include: {
        options: { orderBy: { order: 'asc' } },
        _count: { select: { studentAnswers: true } },
      },
    });
  }

  /**
   * Creates a new question (MCQ or OUTPUT_PREDICTION) for Round 1.
   */
  public async createQuestion(roundId: string, input: CreateQuestionInput, userId?: string) {
    const questionText = (input.questionText || '').trim();
    if (!questionText) {
      throw { statusCode: 400, message: 'Question text is required' };
    }
    if (!input.questionType) {
      throw { statusCode: 400, message: 'Question type is required' };
    }
    if (!input.marks || input.marks <= 0) {
      throw { statusCode: 400, message: 'Marks must be greater than 0' };
    }

    // Determine order
    let order = input.order;
    if (order === undefined || order === null) {
      const lastQ = await prisma.question.findFirst({
        where: { roundId },
        orderBy: { order: 'desc' },
      });
      order = (lastQ?.order || 0) + 1;
    }

    if (input.questionType === QuestionType.MCQ) {
      if (!input.options || input.options.length < 2) {
        throw { statusCode: 400, message: 'MCQ questions require at least 2 options' };
      }
      if (!input.correctAnswer) {
        throw { statusCode: 400, message: 'Correct answer option key is required for MCQ' };
      }
    }

    if (input.questionType === QuestionType.OUTPUT_PREDICTION) {
      if (!input.correctOutput) {
        throw { statusCode: 400, message: 'Expected correct output is required for OUTPUT_PREDICTION' };
      }
    }

    return await prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          roundId,
          questionText,
          questionType: input.questionType,
          marks: input.marks,
          negativeMarks: input.negativeMarks || 0,
          order,
          isActive: input.isActive !== undefined ? input.isActive : true,
          correctAnswer: input.correctAnswer,
          code: input.code,
          correctOutput: input.correctOutput,
          comparisonMethod: input.comparisonMethod || ComparisonMethod.TRIM,
        },
      });

      if (input.questionType === QuestionType.MCQ && input.options) {
        for (const opt of input.options) {
          await tx.questionOption.create({
            data: {
              questionId: question.id,
              optionKey: opt.optionKey,
              optionText: opt.optionText,
              order: opt.order,
            },
          });
        }
      }

      await this.logAudit('QUESTION_CREATED', question.id, userId, { questionText: question.questionText });

      return tx.question.findUnique({
        where: { id: question.id },
        include: { options: { orderBy: { order: 'asc' } } },
      });
    });
  }

  /**
   * Updates an existing question and options.
   */
  public async updateQuestion(id: string, input: UpdateQuestionInput, userId?: string) {
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) {
      throw { statusCode: 404, message: 'Question not found' };
    }

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.question.update({
        where: { id },
        data: {
          questionText: input.questionText !== undefined ? input.questionText.trim() : undefined,
          questionType: input.questionType,
          marks: input.marks,
          negativeMarks: input.negativeMarks,
          order: input.order,
          isActive: input.isActive,
          correctAnswer: input.correctAnswer,
          code: input.code,
          correctOutput: input.correctOutput,
          comparisonMethod: input.comparisonMethod,
        },
      });

      // Update options if provided for MCQ
      if (input.options && (updated.questionType === QuestionType.MCQ || updated.questionType === QuestionType.MULTIPLE_CHOICE)) {
        await tx.questionOption.deleteMany({ where: { questionId: id } });
        for (const opt of input.options) {
          await tx.questionOption.create({
            data: {
              questionId: id,
              optionKey: opt.optionKey,
              optionText: opt.optionText,
              order: opt.order,
            },
          });
        }
      }

      await this.logAudit('QUESTION_UPDATED', id, userId);

      return tx.question.findUnique({
        where: { id },
        include: { options: { orderBy: { order: 'asc' } } },
      });
    });
  }

  /**
   * Deletes a question. If student answers exist, deactivates it instead to preserve history.
   */
  public async deleteQuestion(id: string, userId?: string) {
    const question = await prisma.question.findUnique({
      where: { id },
      include: { _count: { select: { studentAnswers: true } } },
    });

    if (!question) {
      throw { statusCode: 404, message: 'Question not found' };
    }

    if (question._count.studentAnswers > 0) {
      // Soft deactivate to preserve student answer integrity
      await prisma.question.update({
        where: { id },
        data: { isActive: false },
      });
      await this.logAudit('QUESTION_DEACTIVATED', id, userId, { reason: 'Has student answers' });
      return { message: 'Question deactivated (student answers preserved)' };
    }

    await prisma.question.delete({ where: { id } });
    await this.logAudit('QUESTION_DELETED', id, userId);
    return { message: 'Question deleted successfully' };
  }

  /**
   * Reorders questions in a round.
   */
  public async reorderQuestions(roundId: string, orderedQuestionIds: string[], userId?: string) {
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedQuestionIds.length; i++) {
        await tx.question.update({
          where: { id: orderedQuestionIds[i] },
          data: { order: i + 1 },
        });
      }
    });

    if (orderedQuestionIds[0]) {
      await this.logAudit('QUESTIONS_REORDERED', orderedQuestionIds[0], userId);
    }

    return this.getAdminQuestions(roundId);
  }

  /**
   * Toggles question active status.
   */
  public async toggleQuestionActive(id: string, isActive: boolean, userId?: string) {
    const question = await prisma.question.update({
      where: { id },
      data: { isActive },
    });
    await this.logAudit(isActive ? 'QUESTION_ACTIVATED' : 'QUESTION_DEACTIVATED', id, userId);
    return question;
  }

  // ==========================================
  // STUDENT QUIZ & ANSWERS (PROTECTED)
  // ==========================================

  /**
   * Loads Round 1 questions for a student while LIVE.
   * STRIPS SENSITIVE FIELDS (correctAnswer, correctOutput, comparisonMethod).
   */
  public async getStudentQuiz(roundId: string, studentId: string) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    if (round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: `Round 1 is currently ${round.status}. Quiz is accessible only when LIVE.` };
    }

    // Check if student has already submitted Round 1
    const progress = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });

    if (progress && progress.status === RoundProgressStatus.SUBMITTED) {
      const score = await prisma.roundScore.findUnique({
        where: { studentId_roundId: { studentId, roundId } },
      });
      return {
        isSubmitted: true,
        submittedAt: progress.submittedAt,
        score: score ? score.score : undefined,
        maximumScore: score ? score.maximumScore : undefined,
        message: 'You have submitted Round 1. Answers are locked.',
      };
    }

    // Calculate server remaining seconds
    const now = Date.now();
    const endTimeMs = round.endTime ? round.endTime.getTime() : now;
    const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));

    // Fetch active questions and options
    const questions = await prisma.question.findMany({
      where: { roundId, isActive: true },
      orderBy: { order: 'asc' },
      include: {
        options: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            questionId: true,
            optionKey: true,
            optionText: true,
            order: true,
          },
        },
      },
    });

    // STRIP SENSITIVE FIELDS from student response
    const sanitizedQuestions = questions.map((q) => ({
      id: q.id,
      roundId: q.roundId,
      questionText: q.questionText,
      questionType: q.questionType,
      code: q.code,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      order: q.order,
      options: q.options,
    }));

    // Fetch student's existing saved answers
    const savedAnswers = await prisma.studentAnswer.findMany({
      where: {
        studentId,
        question: { roundId },
      },
      select: {
        questionId: true,
        answer: true,
      },
    });

    return {
      isSubmitted: false,
      round: {
        id: round.id,
        name: round.name,
        duration: round.duration,
        remainingSeconds,
        endTime: round.endTime,
      },
      questions: sanitizedQuestions,
      savedAnswers,
    };
  }

  /**
   * Auto-saves a student's answer for a question in PostgreSQL.
   */
  public async saveStudentAnswer(roundId: string, studentId: string, questionId: string, answer: string) {
    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round || round.status !== RoundStatus.LIVE) {
      throw { statusCode: 400, message: 'Cannot save answers: Round 1 is not LIVE' };
    }

    // Check deadline
    if (round.endTime && new Date() > round.endTime) {
      throw { statusCode: 400, message: 'Round 1 deadline has passed' };
    }

    // Check submission & lock status
    const progress = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId, roundId } },
    });

    if (progress && progress.status === RoundProgressStatus.LOCKED) {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    if (progress && progress.status === RoundProgressStatus.SUBMITTED) {
      throw { statusCode: 400, message: 'Cannot modify answers: Round 1 has been submitted' };
    }

    // Verify question belongs to round and is active
    const question = await prisma.question.findFirst({
      where: { id: questionId, roundId, isActive: true },
    });

    if (!question) {
      throw { statusCode: 404, message: 'Question not found or inactive' };
    }

    const trimmedAnswer = (answer || '').trim();

    // Upsert student answer in PostgreSQL
    const savedAnswer = await prisma.studentAnswer.upsert({
      where: { studentId_questionId: { studentId, questionId } },
      create: {
        studentId,
        questionId,
        answer: trimmedAnswer,
      },
      update: {
        answer: trimmedAnswer,
        updatedAt: new Date(),
      },
    });

    // Ensure RoundProgress exists and is IN_PROGRESS
    await prisma.roundProgress.upsert({
      where: { studentId_roundId: { studentId, roundId } },
      create: {
        studentId,
        roundId,
        status: RoundProgressStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      update: {
        status: RoundProgressStatus.IN_PROGRESS,
      },
    });

    return {
      status: 'success',
      questionId,
      answer: savedAnswer.answer,
    };
  }

  /**
   * Submits Round 1 for a student, evaluates answers against correct criteria,
   * calculates marks and negative marks, floors score at 0, and records RoundScore.
   */
  public async submitStudentRound1(roundId: string, studentId: string) {
    return await prisma.$transaction(async (tx) => {
      // Check if already submitted
      const existingProgress = await tx.roundProgress.findUnique({
        where: { studentId_roundId: { studentId, roundId } },
      });

      if (existingProgress && existingProgress.status === RoundProgressStatus.LOCKED) {
        throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
      }

      if (existingProgress && existingProgress.status === RoundProgressStatus.SUBMITTED) {
        const existingScore = await tx.roundScore.findUnique({
          where: { studentId_roundId: { studentId, roundId } },
        });
        return {
          status: 'SUBMITTED',
          score: existingScore ? existingScore.score : 0,
          maximumScore: existingScore ? existingScore.maximumScore : 0,
          submittedAt: existingProgress.submittedAt,
        };
      }

      // Fetch all active questions with correct answers
      const questions = await tx.question.findMany({
        where: { roundId, isActive: true },
      });

      // Fetch student's saved answers
      const studentAnswers = await tx.studentAnswer.findMany({
        where: {
          studentId,
          question: { roundId },
        },
      });

      const answerMap = new Map<string, string>();
      for (const sa of studentAnswers) {
        answerMap.set(sa.questionId, sa.answer);
      }

      let totalScore = 0;
      let maximumScore = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      let unansweredCount = 0;

      for (const q of questions) {
        maximumScore += q.marks;
        const studentAns = answerMap.get(q.id);

        if (!studentAns || studentAns.trim().length === 0) {
          unansweredCount++;
          continue;
        }

        let isCorrect = false;

        if (q.questionType === QuestionType.MCQ || q.questionType === QuestionType.MULTIPLE_CHOICE) {
          if (q.correctAnswer && studentAns.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase()) {
            isCorrect = true;
          }
        } else if (q.questionType === QuestionType.OUTPUT_PREDICTION) {
          const expected = (q.correctOutput || '').trim();
          const actual = studentAns.trim();

          if (q.comparisonMethod === ComparisonMethod.EXACT) {
            isCorrect = studentAns === q.correctOutput;
          } else if (q.comparisonMethod === ComparisonMethod.EXACT_IGNORE_CASE) {
            isCorrect = actual.toLowerCase() === expected.toLowerCase();
          } else {
            // Default TRIM
            isCorrect = actual === expected;
          }
        }

        if (isCorrect) {
          correctCount++;
          totalScore += q.marks;
        } else {
          incorrectCount++;
          totalScore -= (q.negativeMarks || 0);
        }
      }

      // Floor score at 0
      const finalScore = Math.max(0, totalScore);

      // Upsert RoundScore
      const scoreRecord = await tx.roundScore.upsert({
        where: { studentId_roundId: { studentId, roundId } },
        create: {
          studentId,
          roundId,
          score: finalScore,
          maximumScore,
          calculatedAt: new Date(),
        },
        update: {
          score: finalScore,
          maximumScore,
          calculatedAt: new Date(),
        },
      });

      // Update RoundProgress to SUBMITTED
      const progressRecord = await tx.roundProgress.upsert({
        where: { studentId_roundId: { studentId, roundId } },
        create: {
          studentId,
          roundId,
          status: RoundProgressStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        update: {
          status: RoundProgressStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ROUND1_SUBMITTED',
          entity: 'RoundScore',
          entityId: scoreRecord.id,
          userId: studentId,
          metadata: {
            roundId,
            score: finalScore,
            maximumScore,
            correctCount,
            incorrectCount,
            unansweredCount,
          },
        },
      });

      return {
        status: 'SUBMITTED',
        score: finalScore,
        maximumScore,
        submittedAt: progressRecord.submittedAt,
        correctCount,
        incorrectCount,
        unansweredCount,
      };
    });
  }

  // ==========================================
  // ADMIN INSPECTION & RESULTS
  // ==========================================

  /**
   * Returns a student's Round 1 answers, correct answers, awarded marks, and overall score for Admin inspection.
   */
  public async getStudentRound1Answers(roundId: string, studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw { statusCode: 404, message: 'Student not found' };
    }

    const questions = await prisma.question.findMany({
      where: { roundId, isActive: true },
      orderBy: { order: 'asc' },
      include: { options: { orderBy: { order: 'asc' } } },
    });

    const studentAnswers = await prisma.studentAnswer.findMany({
      where: { studentId: student.id, question: { roundId } },
    });

    const answerMap = new Map<string, string>();
    for (const sa of studentAnswers) {
      answerMap.set(sa.questionId, sa.answer);
    }

    const questionBreakdown = questions.map((q) => {
      const studentAns = answerMap.get(q.id) || '';
      let isCorrect = false;

      if (studentAns.trim().length > 0) {
        if (q.questionType === QuestionType.MCQ || q.questionType === QuestionType.MULTIPLE_CHOICE) {
          isCorrect = !!q.correctAnswer && studentAns.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
        } else if (q.questionType === QuestionType.OUTPUT_PREDICTION) {
          const expected = (q.correctOutput || '').trim();
          const actual = studentAns.trim();
          if (q.comparisonMethod === ComparisonMethod.EXACT) {
            isCorrect = studentAns === q.correctOutput;
          } else {
            isCorrect = actual === expected;
          }
        }
      }

      let marksAwarded = 0;
      if (studentAns.trim().length > 0) {
        marksAwarded = isCorrect ? q.marks : -(q.negativeMarks || 0);
      }

      return {
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        code: q.code,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        correctAnswer: q.correctAnswer,
        correctOutput: q.correctOutput,
        comparisonMethod: q.comparisonMethod,
        studentAnswer: studentAns,
        isCorrect,
        marksAwarded,
        options: q.options,
      };
    });

    const score = await prisma.roundScore.findUnique({
      where: { studentId_roundId: { studentId: student.id, roundId } },
    });

    const progress = await prisma.roundProgress.findUnique({
      where: { studentId_roundId: { studentId: student.id, roundId } },
    });

    return {
      student: {
        id: student.id,
        studentId: student.studentId,
        fullName: student.fullName,
        batchNumber: student.batchNumber,
      },
      score: score ? score.score : 0,
      maximumScore: score ? score.maximumScore : 0,
      submissionStatus: progress ? progress.status : 'NOT_STARTED',
      submittedAt: progress ? progress.submittedAt : null,
      questions: questionBreakdown,
    };
  }

  /**
   * Retrieves summary leaderboard of all student scores and submission statuses for Round 1.
   */
  public async getRound1Scores(roundId: string) {
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

export const round1Service = new Round1Service();
