import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { adminStudentController } from '../controllers/adminStudent.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Protect ALL admin student management routes with requireAuth & requireRole(ADMIN)
router.use(requireAuth);
router.use(requireRole(UserRole.ADMIN));

router.get('/', (req, res, next) => adminStudentController.getStudentsList(req, res, next));
router.get('/:studentId', (req, res, next) => adminStudentController.getStudentDetail(req, res, next));
router.patch('/:studentId/status', (req, res, next) => adminStudentController.toggleStudentAccount(req, res, next));

export default router;
