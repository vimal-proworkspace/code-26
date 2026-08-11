import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

const router = Router();

/**
 * GET /api/rounds/current
 * Student-safe endpoint returning minimal round status information.
 * Does NOT expose correct answers, admin config, or other students' data.
 */
router.get(
  '/current',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Find the primary event
      const event = await prisma.event.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, status: true },
      });

      if (!event) {
        res.status(200).json({ status: 'success', data: { event: null, rounds: [] } });
        return;
      }

      const rounds = await prisma.round.findMany({
        where: { eventId: event.id },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          order: true,
          duration: true,
          isEnabled: true,
          startTime: true,
          endTime: true,
        },
      });

      res.status(200).json({
        status: 'success',
        data: {
          event: {
            id: event.id,
            name: event.name,
            status: event.status,
          },
          rounds,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
