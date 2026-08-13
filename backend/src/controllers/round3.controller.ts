import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { round3Service } from '../services/round3.service';
import { queryOne } from '../config/database';

export class Round3Controller {
  /**
   * Resolve the Student table primary key (UUID) from the authenticated User id.
   */
  private async getStudentId(userId: string): Promise<string> {
    const student = await queryOne<{ id: string }>(
      `SELECT id FROM students WHERE "userId" = $1`,
      [userId]
    );
    if (!student) {
      throw { statusCode: 404, message: 'Student profile not found' };
    }
    return student.id;
  }

  // ==========================================
  // ADMIN HANDLERS
  // ==========================================

  public async getAdminProblems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      const problems = await round3Service.getAdminProblems(roundId);
      res.status(200).json({ status: 'success', data: problems });
    } catch (err) {
      next(err);
    }
  }

  public async createProgrammingProblem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      const userId = req.user?.userId;
      const problem = await round3Service.createProgrammingProblem(roundId, req.body, userId);
      res.status(201).json({ status: 'success', data: problem });
    } catch (err) {
      next(err);
    }
  }

  public async updateProgrammingProblem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.userId;
      const problem = await round3Service.updateProgrammingProblem(problemId, req.body, userId);
      res.status(200).json({ status: 'success', data: problem });
    } catch (err) {
      next(err);
    }
  }

  public async deleteProgrammingProblem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.userId;
      const result = await round3Service.deleteProgrammingProblem(problemId, userId);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  public async createTestCase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.userId;
      const testCase = await round3Service.createTestCase(problemId, req.body, userId);
      res.status(201).json({ status: 'success', data: testCase });
    } catch (err) {
      next(err);
    }
  }

  public async updateTestCase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { testCaseId } = req.params;
      const userId = req.user?.userId;
      const testCase = await round3Service.updateTestCase(testCaseId, req.body, userId);
      res.status(200).json({ status: 'success', data: testCase });
    } catch (err) {
      next(err);
    }
  }

  public async deleteTestCase(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { testCaseId } = req.params;
      const userId = req.user?.userId;
      const result = await round3Service.deleteTestCase(testCaseId, userId);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  public async getAdminSubmissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const studentId = req.query.studentId as string | undefined;
      const submissions = await round3Service.getAdminSubmissions(problemId, studentId);
      res.status(200).json({ status: 'success', data: submissions });
    } catch (err) {
      next(err);
    }
  }

  public async getRound3Scores(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      const scores = await round3Service.getRound3Scores(roundId);
      res.status(200).json({ status: 'success', data: scores });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // STUDENT HANDLERS
  // ==========================================

  public async getStudentRound3(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }
      const studentId = await this.getStudentId(req.user.userId);
      const data = await round3Service.getStudentRound3(roundId, studentId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async saveStudentCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }
      const studentId = await this.getStudentId(req.user.userId);
      const { language, code } = req.body;
      const result = await round3Service.saveStudentCode(roundId, studentId, language || 'C', code || '');
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  public async runStudentCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }
      const studentId = await this.getStudentId(req.user.userId);
      const { problemId, language, code } = req.body;

      if (!problemId || !language || !code) {
        res.status(400).json({ status: 'error', message: 'Problem ID, language, and code are required' });
        return;
      }

      const result = await round3Service.runStudentCode(roundId, studentId, problemId, language, code);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  public async submitStudentCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }
      const studentId = await this.getStudentId(req.user.userId);
      const { problemId, language, code } = req.body;

      if (!problemId || !language || !code) {
        res.status(400).json({ status: 'error', message: 'Problem ID, language, and code are required' });
        return;
      }

      const result = await round3Service.submitStudentCode(roundId, studentId, problemId, language, code);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const round3Controller = new Round3Controller();
