import { QuestionType, ComparisonMethod, RoundStatus, RoundProgressStatus, DbQuestion, DbQuestionOption, DbStudentAnswer, DbRoundProgress, DbRoundScore, DbRound } from '../config/types';
import { query, queryOne, transaction, txQuery, txQueryOne, txExecute } from '../config/database';

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
  private async logAudit(action: string, entityId: string, userId?: string, metadata?: Record<string, unknown>) {
    try {
      await query(
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), $1, 'Question', $2, $3, $4, NOW())`,
        [action, entityId, userId || null, metadata ? JSON.stringify(metadata) : null]
      );
    } catch (err) {
      console.error('Failed to create Round 1 audit log:', err);
    }
  }

  // ==========================================
  // ADMIN QUESTION MANAGEMENT
  // ==========================================

  public async getAdminQuestions(roundId: string) {
    const questions = await query<DbQuestion>(
      `SELECT * FROM questions WHERE "roundId" = $1 ORDER BY "order" ASC`,
      [roundId]
    );

    return Promise.all(
      questions.map(async (q) => {
        const options = await query<DbQuestionOption>(
          `SELECT * FROM question_options WHERE "questionId" = $1 ORDER BY "order" ASC`,
          [q.id]
        );
        const countRes = await queryOne<{ count: string }>(
          `SELECT COUNT(*) FROM student_answers WHERE "questionId" = $1`,
          [q.id]
        );
        return {
          ...q,
          options,
          _count: { studentAnswers: parseInt(countRes?.count || '0', 10) },
        };
      })
    );
  }

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

    let order = input.order;
    if (order === undefined || order === null) {
      const lastQ = await queryOne<{ max_order: number }>(
        `SELECT MAX("order") as max_order FROM questions WHERE "roundId" = $1`,
        [roundId]
      );
      order = (lastQ?.max_order || 0) + 1;
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

    return await transaction(async (client) => {
      const question = await txQueryOne<DbQuestion>(client,
        `INSERT INTO questions (id, "roundId", "questionText", "questionType", marks, "negativeMarks", "order", "isActive", "correctAnswer", code, "correctOutput", "comparisonMethod", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
         RETURNING *`,
        [
          roundId,
          questionText,
          input.questionType,
          input.marks,
          input.negativeMarks || 0,
          order,
          input.isActive !== undefined ? input.isActive : true,
          input.correctAnswer || null,
          input.code || null,
          input.correctOutput || null,
          input.comparisonMethod || ComparisonMethod.TRIM,
        ]
      );

      if (!question) {
        throw { statusCode: 500, message: 'Failed to create question' };
      }

      if (input.questionType === QuestionType.MCQ && input.options) {
        for (const opt of input.options) {
          await txExecute(client,
            `INSERT INTO question_options (id, "questionId", "optionKey", "optionText", "order")
             VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
            [question.id, opt.optionKey, opt.optionText, opt.order]
          );
        }
      }

      await txExecute(client,
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'QUESTION_CREATED', 'Question', $1, $2, $3, NOW())`,
        [question.id, userId || null, JSON.stringify({ questionText: question.questionText })]
      );

      const options = await txQuery<DbQuestionOption>(client,
        `SELECT * FROM question_options WHERE "questionId" = $1 ORDER BY "order" ASC`,
        [question.id]
      );

      return { ...question, options };
    });
  }

  public async updateQuestion(id: string, input: UpdateQuestionInput, userId?: string) {
    const existing = await queryOne<DbQuestion>(`SELECT * FROM questions WHERE id = $1`, [id]);
    if (!existing) {
      throw { statusCode: 404, message: 'Question not found' };
    }

    return await transaction(async (client) => {
      const questionText = input.questionText !== undefined ? input.questionText.trim() : existing.questionText;
      const questionType = input.questionType !== undefined ? input.questionType : existing.questionType;
      const marks = input.marks !== undefined ? input.marks : existing.marks;
      const negativeMarks = input.negativeMarks !== undefined ? input.negativeMarks : existing.negativeMarks;
      const order = input.order !== undefined ? input.order : existing.order;
      const isActive = input.isActive !== undefined ? input.isActive : existing.isActive;
      const correctAnswer = input.correctAnswer !== undefined ? input.correctAnswer : existing.correctAnswer;
      const code = input.code !== undefined ? input.code : existing.code;
      const correctOutput = input.correctOutput !== undefined ? input.correctOutput : existing.correctOutput;
      const comparisonMethod = input.comparisonMethod !== undefined ? input.comparisonMethod : existing.comparisonMethod;

      const updated = await txQueryOne<DbQuestion>(client,
        `UPDATE questions
         SET "questionText" = $1, "questionType" = $2, marks = $3, "negativeMarks" = $4,
             "order" = $5, "isActive" = $6, "correctAnswer" = $7, code = $8,
             "correctOutput" = $9, "comparisonMethod" = $10, "updatedAt" = NOW()
         WHERE id = $11
         RETURNING *`,
        [questionText, questionType, marks, negativeMarks, order, isActive, correctAnswer, code, correctOutput, comparisonMethod, id]
      );

      if (input.options && (questionType === QuestionType.MCQ || questionType === QuestionType.MULTIPLE_CHOICE)) {
        await txExecute(client, `DELETE FROM question_options WHERE "questionId" = $1`, [id]);
        for (const opt of input.options) {
          await txExecute(client,
            `INSERT INTO question_options (id, "questionId", "optionKey", "optionText", "order")
             VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
            [id, opt.optionKey, opt.optionText, opt.order]
          );
        }
      }

      await txExecute(client,
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'QUESTION_UPDATED', 'Question', $1, $2, NULL, NOW())`,
        [id, userId || null]
      );

      const options = await txQuery<DbQuestionOption>(client,
        `SELECT * FROM question_options WHERE "questionId" = $1 ORDER BY "order" ASC`,
        [id]
      );

      return { ...updated, options };
    });
  }

  public async deleteQuestion(id: string, userId?: string) {
    const question = await queryOne<DbQuestion>(`SELECT * FROM questions WHERE id = $1`, [id]);
    if (!question) {
      throw { statusCode: 404, message: 'Question not found' };
    }

    const answerCountRes = await queryOne<{ count: string }>(
      `SELECT COUNT(*) FROM student_answers WHERE "questionId" = $1`,
      [id]
    );

    if (parseInt(answerCountRes?.count || '0', 10) > 0) {
      await query(`UPDATE questions SET "isActive" = false, "updatedAt" = NOW() WHERE id = $1`, [id]);
      await this.logAudit('QUESTION_DEACTIVATED', id, userId, { reason: 'Has student answers' });
      return { message: 'Question deactivated (student answers preserved)' };
    }

    await query(`DELETE FROM questions WHERE id = $1`, [id]);
    await this.logAudit('QUESTION_DELETED', id, userId);
    return { message: 'Question deleted successfully' };
  }

  public async reorderQuestions(roundId: string, orderedQuestionIds: string[], userId?: string) {
    await transaction(async (client) => {
      for (let i = 0; i < orderedQuestionIds.length; i++) {
        await txExecute(client, `UPDATE questions SET "order" = $1, "updatedAt" = NOW() WHERE id = $2`, [i + 1, orderedQuestionIds[i]]);
      }
    });

    if (orderedQuestionIds[0]) {
      await this.logAudit('QUESTIONS_REORDERED', orderedQuestionIds[0], userId);
    }

    return this.getAdminQuestions(roundId);
  }

  public async toggleQuestionActive(id: string, isActive: boolean, userId?: string) {
    const question = await queryOne<DbQuestion>(
      `UPDATE questions SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2 RETURNING *`,
      [isActive, id]
    );
    await this.logAudit(isActive ? 'QUESTION_ACTIVATED' : 'QUESTION_DEACTIVATED', id, userId);
    return question;
  }

  // ==========================================
  // STUDENT QUIZ & ANSWERS
  // ==========================================

  public async getStudentQuiz(roundId: string, studentId: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);
    if (!round) {
      throw { statusCode: 404, message: 'Round not found' };
    }

    if (round.status !== 'LIVE') {
      throw { statusCode: 400, message: `Round 1 is currently ${round.status}. Quiz is accessible only when LIVE.` };
    }

    const progress = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );

    if (progress && progress.status === 'SUBMITTED') {
      const score = await queryOne<DbRoundScore>(
        `SELECT * FROM round_scores WHERE "studentId" = $1 AND "roundId" = $2`,
        [studentId, roundId]
      );
      return {
        isSubmitted: true,
        submittedAt: progress.submittedAt,
        score: score ? score.score : undefined,
        maximumScore: score ? score.maximumScore : undefined,
        message: 'You have submitted Round 1. Answers are locked.',
      };
    }

    const now = Date.now();
    const endTimeMs = round.endTime ? new Date(round.endTime).getTime() : now;
    const remainingSeconds = Math.max(0, Math.floor((endTimeMs - now) / 1000));

    const questions = await query<DbQuestion>(
      `SELECT * FROM questions WHERE "roundId" = $1 AND "isActive" = true ORDER BY "order" ASC`,
      [roundId]
    );

    const sanitizedQuestions = await Promise.all(
      questions.map(async (q) => {
        const options = await query<DbQuestionOption>(
          `SELECT id, "questionId", "optionKey", "optionText", "order" FROM question_options WHERE "questionId" = $1 ORDER BY "order" ASC`,
          [q.id]
        );
        return {
          id: q.id,
          roundId: q.roundId,
          questionText: q.questionText,
          questionType: q.questionType,
          code: q.code,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          order: q.order,
          options,
        };
      })
    );

    const savedAnswers = await query<{ questionId: string; answer: string }>(
      `SELECT sa."questionId", sa.answer
       FROM student_answers sa
       JOIN questions q ON q.id = sa."questionId"
       WHERE sa."studentId" = $1 AND q."roundId" = $2`,
      [studentId, roundId]
    );

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

  public async saveStudentAnswer(roundId: string, studentId: string, questionId: string, answer: string) {
    const round = await queryOne<DbRound>(`SELECT * FROM rounds WHERE id = $1`, [roundId]);
    if (!round || round.status !== 'LIVE') {
      throw { statusCode: 400, message: 'Cannot save answers: Round 1 is not LIVE' };
    }

    if (round.endTime && new Date() > new Date(round.endTime)) {
      throw { statusCode: 400, message: 'Round 1 deadline has passed' };
    }

    const progress = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [studentId, roundId]
    );

    if (progress && progress.status === 'LOCKED') {
      throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
    }

    if (progress && progress.status === 'SUBMITTED') {
      throw { statusCode: 400, message: 'Cannot modify answers: Round 1 has been submitted' };
    }

    const question = await queryOne<DbQuestion>(
      `SELECT * FROM questions WHERE id = $1 AND "roundId" = $2 AND "isActive" = true`,
      [questionId, roundId]
    );

    if (!question) {
      throw { statusCode: 404, message: 'Question not found or inactive' };
    }

    const trimmedAnswer = (answer || '').trim();

    // Upsert student answer in PostgreSQL using ON CONFLICT
    const savedAnswer = await queryOne<DbStudentAnswer>(
      `INSERT INTO student_answers (id, "studentId", "questionId", answer, "submittedAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       ON CONFLICT ("studentId", "questionId")
       DO UPDATE SET answer = $3, "updatedAt" = NOW()
       RETURNING *`,
      [studentId, questionId, trimmedAnswer]
    );

    // Upsert RoundProgress
    await query(
      `INSERT INTO round_progress (id, "studentId", "roundId", status, "startedAt")
       VALUES (gen_random_uuid(), $1, $2, 'IN_PROGRESS', NOW())
       ON CONFLICT ("studentId", "roundId")
       DO UPDATE SET status = 'IN_PROGRESS'`,
      [studentId, roundId]
    );

    return {
      status: 'success',
      questionId,
      answer: savedAnswer!.answer,
    };
  }

  public async submitStudentRound1(roundId: string, studentId: string) {
    return await transaction(async (client) => {
      const existingProgress = await txQueryOne<DbRoundProgress>(client,
        `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
        [studentId, roundId]
      );

      if (existingProgress && existingProgress.status === 'LOCKED') {
        throw { statusCode: 403, message: 'Competition interface is locked due to violation limit. Contact invigilator.' };
      }

      if (existingProgress && existingProgress.status === 'SUBMITTED') {
        const existingScore = await txQueryOne<DbRoundScore>(client,
          `SELECT * FROM round_scores WHERE "studentId" = $1 AND "roundId" = $2`,
          [studentId, roundId]
        );
        return {
          status: 'SUBMITTED',
          score: existingScore ? existingScore.score : 0,
          maximumScore: existingScore ? existingScore.maximumScore : 0,
          submittedAt: existingProgress.submittedAt,
        };
      }

      const questions = await txQuery<DbQuestion>(client,
        `SELECT * FROM questions WHERE "roundId" = $1 AND "isActive" = true`,
        [roundId]
      );

      const studentAnswers = await txQuery<DbStudentAnswer>(client,
        `SELECT sa.* FROM student_answers sa JOIN questions q ON q.id = sa."questionId" WHERE sa."studentId" = $1 AND q."roundId" = $2`,
        [studentId, roundId]
      );

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

      const finalScore = Math.max(0, totalScore);

      const scoreRecord = await txQueryOne<DbRoundScore>(client,
        `INSERT INTO round_scores (id, "studentId", "roundId", score, "maximumScore", "submittedAt", "calculatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT ("studentId", "roundId")
         DO UPDATE SET score = $3, "maximumScore" = $4, "calculatedAt" = NOW()
         RETURNING *`,
        [studentId, roundId, finalScore, maximumScore]
      );

      const progressRecord = await txQueryOne<DbRoundProgress>(client,
        `INSERT INTO round_progress (id, "studentId", "roundId", status, "submittedAt")
         VALUES (gen_random_uuid(), $1, $2, 'SUBMITTED', NOW())
         ON CONFLICT ("studentId", "roundId")
         DO UPDATE SET status = 'SUBMITTED', "submittedAt" = NOW()
         RETURNING *`,
        [studentId, roundId]
      );

      await txExecute(client,
        `INSERT INTO audit_logs (id, action, entity, "entityId", "userId", metadata, "createdAt")
         VALUES (gen_random_uuid(), 'ROUND1_SUBMITTED', 'RoundScore', $1, $2, $3, NOW())`,
        [scoreRecord!.id, studentId, JSON.stringify({ roundId, score: finalScore, maximumScore, correctCount, incorrectCount, unansweredCount })]
      );

      return {
        status: 'SUBMITTED',
        score: finalScore,
        maximumScore,
        submittedAt: progressRecord!.submittedAt,
        correctCount,
        incorrectCount,
        unansweredCount,
      };
    });
  }

  // ==========================================
  // ADMIN INSPECTION & RESULTS
  // ==========================================

  public async getStudentRound1Answers(roundId: string, studentId: string) {
    const student = await queryOne<{ id: string; studentId: string; fullName: string; batchNumber: string }>(
      `SELECT id, "studentId", "fullName", "batchNumber" FROM students WHERE id = $1`,
      [studentId]
    );

    if (!student) {
      throw { statusCode: 404, message: 'Student not found' };
    }

    const questions = await query<DbQuestion>(
      `SELECT * FROM questions WHERE "roundId" = $1 AND "isActive" = true ORDER BY "order" ASC`,
      [roundId]
    );

    const studentAnswers = await query<DbStudentAnswer>(
      `SELECT sa.* FROM student_answers sa JOIN questions q ON q.id = sa."questionId" WHERE sa."studentId" = $1 AND q."roundId" = $2`,
      [student.id, roundId]
    );

    const answerMap = new Map<string, string>();
    for (const sa of studentAnswers) {
      answerMap.set(sa.questionId, sa.answer);
    }

    const questionBreakdown = await Promise.all(
      questions.map(async (q) => {
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

        const options = await query<DbQuestionOption>(
          `SELECT * FROM question_options WHERE "questionId" = $1 ORDER BY "order" ASC`,
          [q.id]
        );

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
          options,
        };
      })
    );

    const score = await queryOne<DbRoundScore>(
      `SELECT * FROM round_scores WHERE "studentId" = $1 AND "roundId" = $2`,
      [student.id, roundId]
    );

    const progress = await queryOne<DbRoundProgress>(
      `SELECT * FROM round_progress WHERE "studentId" = $1 AND "roundId" = $2`,
      [student.id, roundId]
    );

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

  public async getRound1Scores(roundId: string) {
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

export const round1Service = new Round1Service();
