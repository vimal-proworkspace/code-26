import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { violationController } from '../controllers/violation.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Student-accessible violation endpoints (protected by requireAuth)
router.post('/', requireAuth, (req, res, next) => violationController.recordViolation(req, res, next));
router.get('/status', requireAuth, (req, res, next) => violationController.getStudentViolationState(req, res, next));

// Invigilator unlock endpoint (requires auth and password payload)
router.post('/unlock', requireAuth, (req, res, next) => violationController.invigilatorUnlock(req, res, next));

// Admin-only overview routes
router.get('/admin/overview', requireAuth, requireRole(UserRole.ADMIN), (req, res, next) =>
  violationController.getAdminViolationOverview(req, res, next)
);

export default router;
