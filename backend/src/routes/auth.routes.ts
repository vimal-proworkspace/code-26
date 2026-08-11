import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Rate limiter protecting login endpoints from brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
});

// Authentication routes
router.post('/student/login', loginLimiter, (req, res, next) => authController.studentLogin(req, res, next));
router.post('/admin/login', loginLimiter, (req, res, next) => authController.adminLogin(req, res, next));
router.post('/student/register', (req, res, next) => authController.registerStudent(req, res, next));
router.get('/me', requireAuth, (req, res, next) => authController.getCurrentUser(req, res, next));
router.post('/logout', requireAuth, (req, res, next) => authController.logout(req, res, next));

export default router;
