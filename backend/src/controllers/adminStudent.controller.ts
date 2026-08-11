import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { adminStudentService } from '../services/adminStudent.service';

export class AdminStudentController {
  public async getStudentsList(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, statusFilter, roundId, batchNumber, page, limit, sortBy, sortOrder } = req.query;

      const data = await adminStudentService.getStudentsList({
        search: search as string,
        statusFilter: statusFilter as string,
        roundId: roundId as string,
        batchNumber: batchNumber as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 25,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async getStudentDetail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.params;
      if (!studentId) {
        res.status(400).json({ status: 'error', message: 'Student ID parameter is required' });
        return;
      }

      const data = await adminStudentService.getStudentDetail(studentId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async toggleStudentAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { studentId } = req.params;
      const { isActive } = req.body;

      if (isActive === undefined || typeof isActive !== 'boolean') {
        res.status(400).json({ status: 'error', message: 'Boolean property isActive is required' });
        return;
      }

      const data = await adminStudentService.toggleStudentAccount(studentId, isActive, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }
}

export const adminStudentController = new AdminStudentController();
