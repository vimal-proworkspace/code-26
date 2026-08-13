import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { violationService } from '../services/violation.service';
import { ViolationType } from '../config/types';

export class ViolationController {
  public async recordViolation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentUserId = req.user?.userId;
      if (!studentUserId) {
        res.status(401).json({ status: 'error', message: 'User ID missing in request token' });
        return;
      }

      const { violationType, details } = req.body;
      const validTypes: ViolationType[] = ['FULLSCREEN_EXIT', 'TAB_SWITCH', 'WINDOW_BLUR', 'OTHER'];
      if (!violationType || !validTypes.includes(violationType)) {
        res.status(400).json({ status: 'error', message: `Invalid violation type: ${violationType}` });
        return;
      }

      const data = await violationService.recordViolation(studentUserId, { violationType, details });
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async getStudentViolationState(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentUserId = req.user?.userId;
      if (!studentUserId) {
        res.status(401).json({ status: 'error', message: 'User ID missing in request token' });
        return;
      }

      const data = await violationService.getStudentViolationState(studentUserId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async invigilatorUnlock(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { password, studentUserId: targetStudentUserId } = req.body;
      const studentUserId = targetStudentUserId || req.user?.userId;

      if (!password) {
        res.status(400).json({ status: 'error', message: 'Invigilator continuation password is required' });
        return;
      }

      if (!studentUserId) {
        res.status(400).json({ status: 'error', message: 'Student user ID parameter is required' });
        return;
      }

      const data = await violationService.invigilatorUnlock(studentUserId, password, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async getAdminViolationOverview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await violationService.getAdminViolationOverview();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }
}

export const violationController = new ViolationController();
