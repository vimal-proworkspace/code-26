import { Response, NextFunction } from 'express';
import { round1Service } from '../services/round1.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

export class Round1Controller {
  /**
   * Helper to get Student model primary key (id) from authenticated User id.
   */
  private async getStudentId(userId: string): Promise<string> {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) {
      throw { statusCode: 404, message: 'Student profile not found' };
    }
    return student.id;
  }

  // ==========================================
  // ADMIN HANDLERS
  // ==========================================

  public async getAdminQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await round1Service.getAdminQuestions(req.params.roundId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async createQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await round1Service.createQuestion(req.params.roundId, req.body, req.user?.userId);
      res.status(201).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async updateQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await round1Service.updateQuestion(req.params.id, req.body, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async deleteQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await round1Service.deleteQuestion(req.params.id, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async reorderQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await round1Service.reorderQuestions(req.params.roundId, req.body.orderedQuestionIds, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async toggleQuestionActive(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await round1Service.toggleQuestionActive(req.params.id, req.body.isActive, req.user?.userId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async getStudentAnswers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await round1Service.getStudentRound1Answers(req.params.roundId, req.params.studentId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async getRound1Scores(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await round1Service.getRound1Scores(req.params.roundId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  // ==========================================
  // STUDENT HANDLERS
  // ==========================================

  public async getStudentQuiz(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }
      const studentId = await this.getStudentId(req.user.userId);
      const data = await round1Service.getStudentQuiz(req.params.roundId, studentId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async saveStudentAnswer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }
      const studentId = await this.getStudentId(req.user.userId);
      const { roundId, questionId, answer } = req.body || {};
      const data = await round1Service.saveStudentAnswer(roundId, studentId, questionId, answer);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }

  public async submitRound1(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ status: 'error', message: 'Authentication required' });
        return;
      }
      const studentId = await this.getStudentId(req.user.userId);
      const { roundId } = req.body || {};
      const data = await round1Service.submitStudentRound1(roundId, studentId);
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  }
}

export const round1Controller = new Round1Controller();
