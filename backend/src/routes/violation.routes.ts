import { Router } from 'express';
import { UserRole } from '../config/types';
import { violationController } from '../controllers/violation.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.post('/', requireAuth, (req, res, next) => violationController.recordViolation(req, res, next));
router.get('/status', requireAuth, (req, res, next) => violationController.getStudentViolationState(req, res, next));
router.post('/unlock', requireAuth, (req, res, next) => violationController.invigilatorUnlock(req, res, next));

router.get('/admin/overview', requireAuth, requireRole(UserRole.ADMIN), (req, res, next) =>
  violationController.getAdminViolationOverview(req, res, next)
);

export default router;
