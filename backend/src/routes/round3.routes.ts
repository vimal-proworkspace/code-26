import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import { round3Controller } from '../controllers/round3.controller';

const router = Router();

// Apply base auth middleware
router.use(requireAuth);

// ==========================================
// ADMIN ROUTES (requireRole ADMIN)
// ==========================================

router.get(
  '/admin/rounds/:roundId/problems',
  requireRole(UserRole.ADMIN),
  round3Controller.getAdminProblems.bind(round3Controller)
);

router.post(
  '/admin/rounds/:roundId/problems',
  requireRole(UserRole.ADMIN),
  round3Controller.createProgrammingProblem.bind(round3Controller)
);

router.put(
  '/admin/problems/:problemId',
  requireRole(UserRole.ADMIN),
  round3Controller.updateProgrammingProblem.bind(round3Controller)
);

router.delete(
  '/admin/problems/:problemId',
  requireRole(UserRole.ADMIN),
  round3Controller.deleteProgrammingProblem.bind(round3Controller)
);

router.post(
  '/admin/problems/:problemId/testcases',
  requireRole(UserRole.ADMIN),
  round3Controller.createTestCase.bind(round3Controller)
);

router.put(
  '/admin/testcases/:testCaseId',
  requireRole(UserRole.ADMIN),
  round3Controller.updateTestCase.bind(round3Controller)
);

router.delete(
  '/admin/testcases/:testCaseId',
  requireRole(UserRole.ADMIN),
  round3Controller.deleteTestCase.bind(round3Controller)
);

router.get(
  '/admin/problems/:problemId/submissions',
  requireRole(UserRole.ADMIN),
  round3Controller.getAdminSubmissions.bind(round3Controller)
);

router.get(
  '/admin/rounds/:roundId/scores',
  requireRole(UserRole.ADMIN),
  round3Controller.getRound3Scores.bind(round3Controller)
);

// ==========================================
// STUDENT ROUTES (requireRole STUDENT)
// ==========================================

router.get(
  '/rounds/:roundId/student',
  requireRole(UserRole.STUDENT),
  round3Controller.getStudentRound3.bind(round3Controller)
);

router.post(
  '/rounds/:roundId/save',
  requireRole(UserRole.STUDENT),
  round3Controller.saveStudentCode.bind(round3Controller)
);

router.post(
  '/rounds/:roundId/run',
  requireRole(UserRole.STUDENT),
  round3Controller.runStudentCode.bind(round3Controller)
);

router.post(
  '/rounds/:roundId/submit',
  requireRole(UserRole.STUDENT),
  round3Controller.submitStudentCode.bind(round3Controller)
);

export default router;
