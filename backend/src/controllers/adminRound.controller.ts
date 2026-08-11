import { Response, NextFunction } from 'express';
import { adminRoundService } from '../services/adminRound.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class AdminRoundController {
  public async getRounds(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.getRounds();
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async getRoundById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.getRoundById(req.params.id);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async createRound(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.createRound(req.body, req.user?.userId);
      res.status(201).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async updateRound(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.updateRound(req.params.id, req.body, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async deleteRound(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.deleteRound(req.params.id, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async reorderRounds(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.reorderRounds(req.body.orderedRoundIds, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async toggleRoundEnabled(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.toggleRoundEnabled(req.params.id, req.body.isEnabled, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async startRound(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.startRound(req.params.id, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async pauseRound(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.pauseRound(req.params.id, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async resumeRound(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.resumeRound(req.params.id, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async endRound(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminRoundService.endRound(req.params.id, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async restartRound(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { reason } = req.body || {};
      const data = await adminRoundService.restartRound(req.params.id, reason, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }
}

export const adminRoundController = new AdminRoundController();

