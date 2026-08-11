import { Router, Request, Response } from 'express';
import { checkDatabaseConnection } from '../config/database';

const router = Router();

// GET /health - Basic server health check
router.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'coding-event-platform-backend',
    timestamp: new Date().toISOString(),
  });
});

// GET /health/db - Separate database connectivity check
router.get('/db', async (_req: Request, res: Response) => {
  const dbStatus = await checkDatabaseConnection();
  const httpStatus = dbStatus.connected ? 200 : 503;

  res.status(httpStatus).json({
    database: dbStatus.status,
    timestamp: new Date().toISOString(),
  });
});

export default router;
