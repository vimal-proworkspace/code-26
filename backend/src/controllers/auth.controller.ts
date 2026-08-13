import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { setAuthCookie, clearAuthCookie } from '../utils/jwt';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AuthController {
  public async studentLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId, password } = req.body || {};
      const result = await authService.studentLogin(studentId, password);

      setAuthCookie(res, result.token);

      res.status(200).json({
        status: 'success',
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public async adminLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = req.body || {};
      const result = await authService.adminLogin(username, password);

      setAuthCookie(res, result.token);

      res.status(200).json({
        status: 'success',
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public async registerStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fullName, batchNumber } = req.body || {};
      const result = await authService.registerStudent(fullName, batchNumber);

      setAuthCookie(res, result.token);

      res.status(201).json({
        status: 'success',
        data: {
          user: result.user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public async getCurrentUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }

      const user = await authService.getCurrentUser(req.user.userId);

      res.status(200).json({
        status: 'success',
        data: {
          user,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await authService.logout(req.user.sessionId, req.user.userId);
      }

      clearAuthCookie(res);

      res.status(200).json({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
