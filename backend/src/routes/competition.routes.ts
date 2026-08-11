import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { competitionController } from '../controllers/competition.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Student-accessible results route (checks showResults inside service)
router.get('/results', requireAuth, requireRole(UserRole.STUDENT), (req, res, next) =>
  competitionController.getStudentLeaderboard(req, res, next)
);

// Admin-only competition routes
router.get('/leaderboard', requireAuth, requireRole(UserRole.ADMIN), (req, res, next) =>
  competitionController.getAdminLeaderboard(req, res, next)
);

router.post('/visibility', requireAuth, requireRole(UserRole.ADMIN), (req, res, next) =>
  competitionController.toggleResultsVisibility(req, res, next)
);

router.get('/inspect/:studentId', requireAuth, requireRole(UserRole.ADMIN), (req, res, next) =>
  competitionController.getAdminStudentInspection(req, res, next)
);

export default router;
