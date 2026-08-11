import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { adminRoundController } from '../controllers/adminRound.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Protect ALL routes: Require Authentication AND ADMIN role
router.use(requireAuth);
router.use(requireRole(UserRole.ADMIN));

router.get('/', (req, res, next) => adminRoundController.getRounds(req, res, next));
router.post('/', (req, res, next) => adminRoundController.createRound(req, res, next));
router.patch('/reorder', (req, res, next) => adminRoundController.reorderRounds(req, res, next));

router.get('/:id', (req, res, next) => adminRoundController.getRoundById(req, res, next));
router.put('/:id', (req, res, next) => adminRoundController.updateRound(req, res, next));
router.delete('/:id', (req, res, next) => adminRoundController.deleteRound(req, res, next));
router.patch('/:id/toggle', (req, res, next) => adminRoundController.toggleRoundEnabled(req, res, next));

router.post('/:id/start', (req, res, next) => adminRoundController.startRound(req, res, next));
router.post('/:id/pause', (req, res, next) => adminRoundController.pauseRound(req, res, next));
router.post('/:id/resume', (req, res, next) => adminRoundController.resumeRound(req, res, next));
router.post('/:id/end', (req, res, next) => adminRoundController.endRound(req, res, next));
router.post('/:id/restart', (req, res, next) => adminRoundController.restartRound(req, res, next));

export default router;

