import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { round2Service } from '../services/round2.service';

export class Round2Controller {
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
      const userId = req.user?.id;
      const problem = await round2Service.createDebuggingProblem(roundId, req.body, userId);
      res.status(201).json({ status: 'success', data: problem });
    } catch (err) {
      next(err);
    }
  }

  public async updateDebuggingProblem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.id;
      const problem = await round2Service.updateDebuggingProblem(problemId, req.body, userId);
      res.status(200).json({ status: 'success', data: problem });
    } catch (err) {
      next(err);
    }
  }

  public async deleteDebuggingProblem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.id;
      const result = await round2Service.deleteDebuggingProblem(problemId, userId);
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  public async createBugDefinition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { problemId } = req.params;
      const userId = req.user?.id;
      const bug = await round2Service.createBugDefinition(problemId, req.body, userId);
      res.status(201).json({ status: 'success', data: bug });
    } catch (err) {
      next(err);
    }
  }

  public async updateBugDefinition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { bugDefinitionId } = req.params;
      const userId = req.user?.id;
      const bug = await round2Service.updateBugDefinition(bugDefinitionId, req.body, userId);
      res.status(200).json({ status: 'success', data: bug });
    } catch (err) {
      next(err);
    }
  }

  public async deleteBugDefinition(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { bugDefinitionId } = req.params;
      const userId = req.user?.id;
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
      const studentId = req.user?.studentId;

      if (!studentId) {
        res.status(403).json({ status: 'error', message: 'Only students can access this endpoint' });
        return;
      }

      const data = await round2Service.getStudentRound2(roundId, studentId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async saveStudentCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      const studentId = req.user?.studentId;
      const { code } = req.body;

      if (!studentId) {
        res.status(403).json({ status: 'error', message: 'Only students can save code' });
        return;
      }

      const result = await round2Service.saveStudentCode(roundId, studentId, code || '');
      res.status(200).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  }

  public async runStudentCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { roundId } = req.params;
      const studentId = req.user?.studentId;
      const { problemId, code, input } = req.body;

      if (!studentId) {
        res.status(403).json({ status: 'error', message: 'Only students can run code' });
        return;
      }

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
      const studentId = req.user?.studentId;
      const { problemId, code } = req.body;

      if (!studentId) {
        res.status(403).json({ status: 'error', message: 'Only students can submit code' });
        return;
      }

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
