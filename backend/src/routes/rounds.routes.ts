import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import { query, queryOne } from '../config/database';
import { DbEvent, DbRound } from '../config/types';

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
      const event = await queryOne<DbEvent>(
        `SELECT id, name, status FROM events ORDER BY "createdAt" ASC LIMIT 1`
      );

      if (!event) {
        res.status(200).json({ status: 'success', data: { event: null, rounds: [] } });
        return;
      }

      const rounds = await query<DbRound>(
        `SELECT id, name, type, status, "order", duration, "isEnabled", "startTime", "endTime"
         FROM rounds
         WHERE "eventId" = $1
         ORDER BY "order" ASC`,
        [event.id]
      );

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
