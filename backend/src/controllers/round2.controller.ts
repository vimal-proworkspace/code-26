import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { round2Service } from '../services/round2.service';
import { queryOne } from '../config/database';

export class Round2Controller {
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
      const problems = await round2Service.getAdminProblems(roundId);
      res.status(200).json({ status: 'success', data: problems });
    } catch (err) {
      next(err);
    }
  }

  public async createDebuggingProblem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      const userId = req.user?.userId;
      const problem = await round2Service.createDebuggingProblem(roundId, req.body, userId);
      res.status(201).json({ status: 'success', data: problem });
    } catch (err) {
      next(err);
    }
  }

  public async updateDebuggingProblem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.userId;
      const problem = await round2Service.updateDebuggingProblem(problemId, req.body, userId);
      res.status(200).json({ status: 'success', data: problem });
    } catch (err) {
      next(err);
    }
  }

  public async deleteDebuggingProblem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.userId;
      const result = await round2Service.deleteDebuggingProblem(problemId, userId);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  public async createBugDefinition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.userId;
      const bug = await round2Service.createBugDefinition(problemId, req.body, userId);
      res.status(201).json({ status: 'success', data: bug });
    } catch (err) {
      next(err);
    }
  }

  public async updateBugDefinition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { bugDefinitionId } = req.params;
      const userId = req.user?.userId;
      const bug = await round2Service.updateBugDefinition(bugDefinitionId, req.body, userId);
      res.status(200).json({ status: 'success', data: bug });
    } catch (err) {
      next(err);
    }
  }

  public async deleteBugDefinition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { bugDefinitionId } = req.params;
      const userId = req.user?.userId;
      const result = await round2Service.deleteBugDefinition(bugDefinitionId, userId);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  public async getAdminSubmissions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const studentId = req.query.studentId as string | undefined;
      const submissions = await round2Service.getAdminSubmissions(problemId, studentId);
      res.status(200).json({ status: 'success', data: submissions });
    } catch (err) {
      next(err);
    }
  }

  public async getRound2Scores(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      const scores = await round2Service.getRound2Scores(roundId);
      res.status(200).json({ status: 'success', data: scores });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // STUDENT HANDLERS
  // ==========================================

  public async getStudentRound2(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }
      const studentId = await this.getStudentId(req.user.userId);
      const data = await round2Service.getStudentRound2(roundId, studentId);
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
      const { code } = req.body;
      const result = await round2Service.saveStudentCode(roundId, studentId, code || '');
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
      const { problemId, code, input } = req.body;

      if (!problemId || !code) {
        res.status(400).json({ status: 'error', message: 'Problem ID and source code are required' });
        return;
      }

      const result = await round2Service.runStudentCode(roundId, studentId, problemId, code, input || '');
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
      const { problemId, code } = req.body;

      if (!problemId || !code) {
        res.status(400).json({ status: 'error', message: 'Problem ID and source code are required' });
        return;
      }

      const result = await round2Service.submitStudentCode(roundId, studentId, problemId, code);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const round2Controller = new Round2Controller();
