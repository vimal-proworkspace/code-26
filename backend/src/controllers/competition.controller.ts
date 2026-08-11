import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { competitionService } from '../services/competition.service';

export class CompetitionController {
  public async getAdminLeaderboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await competitionService.getAdminLeaderboard();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async getStudentLeaderboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.user?.studentId || req.user?.userId;
      if (!studentId) {
        res.status(400).json({ status: 'error', message: 'Student ID not found in token session' });
        return;
      }
      const data = await competitionService.getStudentLeaderboard(studentId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async toggleResultsVisibility(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { showResults } = req.body;
      if (typeof showResults !== 'boolean') {
        res.status(400).json({ status: 'error', message: 'showResults boolean parameter is required' });
        return;
      }
      const data = await competitionService.toggleResultsVisibility(showResults, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async getAdminStudentInspection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.params;
      if (!studentId) {
        res.status(400).json({ status: 'error', message: 'Student ID parameter is required' });
        return;
      }
      const data = await competitionService.getAdminStudentInspection(studentId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }
}

export const competitionController = new CompetitionController();
