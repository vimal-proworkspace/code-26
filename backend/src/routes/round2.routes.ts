import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { round2Controller } from '../controllers/round2.controller';

const router = Router();

// Apply base auth middleware
router.use(requireAuth);

// ==========================================
// ADMIN ROUTES (requireRole ADMIN)
// ==========================================

router.get(
  '/admin/rounds/:roundId/problems',
  requireRole(UserRole.ADMIN),
  round2Controller.getAdminProblems.bind(round2Controller)
);

router.post(
  '/admin/rounds/:roundId/problems',
  requireRole(UserRole.ADMIN),
  round2Controller.createDebuggingProblem.bind(round2Controller)
);

router.put(
  '/admin/problems/:problemId',
  requireRole(UserRole.ADMIN),
  round2Controller.updateDebuggingProblem.bind(round2Controller)
);

router.delete(
  '/admin/problems/:problemId',
  requireRole(UserRole.ADMIN),
  round2Controller.deleteDebuggingProblem.bind(round2Controller)
);

router.post(
  '/admin/problems/:problemId/bugs',
  requireRole(UserRole.ADMIN),
  round2Controller.createBugDefinition.bind(round2Controller)
);

router.put(
  '/admin/bugs/:bugDefinitionId',
  requireRole(UserRole.ADMIN),
  round2Controller.updateBugDefinition.bind(round2Controller)
);

router.delete(
  '/admin/bugs/:bugDefinitionId',
  requireRole(UserRole.ADMIN),
  round2Controller.deleteBugDefinition.bind(round2Controller)
);

router.get(
  '/admin/problems/:problemId/submissions',
  requireRole(UserRole.ADMIN),
  round2Controller.getAdminSubmissions.bind(round2Controller)
);

router.get(
  '/admin/rounds/:roundId/scores',
  requireRole(UserRole.ADMIN),
  round2Controller.getRound2Scores.bind(round2Controller)
);

// ==========================================
// STUDENT ROUTES (requireRole STUDENT)
// ==========================================

router.get(
  '/rounds/:roundId/student',
  requireRole(UserRole.STUDENT),
  round2Controller.getStudentRound2.bind(round2Controller)
);

router.post(
  '/rounds/:roundId/save',
  requireRole(UserRole.STUDENT),
  round2Controller.saveStudentCode.bind(round2Controller)
);

router.post(
  '/rounds/:roundId/run',
  requireRole(UserRole.STUDENT),
  round2Controller.runStudentCode.bind(round2Controller)
);

router.post(
  '/rounds/:roundId/submit',
  requireRole(UserRole.STUDENT),
  round2Controller.submitStudentCode.bind(round2Controller)
);

export default router;
