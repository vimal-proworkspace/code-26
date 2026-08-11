import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { round1Controller } from '../controllers/round1.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// ==========================================
// ADMIN ROUTES
// ==========================================
router.get(
  '/admin/questions/:roundId',
  requireAuth,
  requireRole(UserRole.ADMIN),
  (req, res, next) => round1Controller.getAdminQuestions(req, res, next)
);

router.post(
  '/admin/questions/:roundId',
  requireAuth,
  requireRole(UserRole.ADMIN),
  (req, res, next) => round1Controller.createQuestion(req, res, next)
);

router.put(
  '/admin/questions/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  (req, res, next) => round1Controller.updateQuestion(req, res, next)
);

router.delete(
  '/admin/questions/:id',
  requireAuth,
  requireRole(UserRole.ADMIN),
  (req, res, next) => round1Controller.deleteQuestion(req, res, next)
);

router.patch(
  '/admin/questions/:roundId/reorder',
  requireAuth,
  requireRole(UserRole.ADMIN),
  (req, res, next) => round1Controller.reorderQuestions(req, res, next)
);

router.patch(
  '/admin/questions/:id/toggle',
  requireAuth,
  requireRole(UserRole.ADMIN),
  (req, res, next) => round1Controller.toggleQuestionActive(req, res, next)
);

router.get(
  '/admin/inspection/:roundId/student/:studentId',
  requireAuth,
  requireRole(UserRole.ADMIN),
  (req, res, next) => round1Controller.getStudentAnswers(req, res, next)
);

router.get(
  '/admin/scores/:roundId',
  requireAuth,
  requireRole(UserRole.ADMIN),
  (req, res, next) => round1Controller.getRound1Scores(req, res, next)
);

// ==========================================
// STUDENT ROUTES
// ==========================================
router.get(
  '/student/quiz/:roundId',
  requireAuth,
  requireRole(UserRole.STUDENT),
  (req, res, next) => round1Controller.getStudentQuiz(req, res, next)
);

router.post(
  '/student/answer',
  requireAuth,
  requireRole(UserRole.STUDENT),
  (req, res, next) => round1Controller.saveStudentAnswer(req, res, next)
);

router.post(
  '/student/submit',
  requireAuth,
  requireRole(UserRole.STUDENT),
  (req, res, next) => round1Controller.submitRound1(req, res, next)
);

export default router;
