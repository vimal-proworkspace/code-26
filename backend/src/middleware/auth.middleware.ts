import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { verifyAuthToken, AUTH_COOKIE_NAME, AuthTokenPayload } from '../utils/jwt';
import { prisma } from '../config/database';

export interface AuthenticatedUser {
  userId: string;
  role: UserRole;
  sessionId: string;
  username?: string;
  studentId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Middleware enforcing valid JWT and active non-revoked database session.
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract token from HTTP-only cookie or Authorization header
    let token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }

    // 2. Verify JWT signature & expiration
    let payload: AuthTokenPayload;
    try {
      payload = verifyAuthToken(token);
    } catch {
      res.status(401).json({ status: 'error', message: 'Invalid or expired token' });
      return;
    }

    // 3. Verify session in PostgreSQL database
    const dbSession = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!dbSession || dbSession.revokedAt || dbSession.expiresAt < new Date()) {
      res.status(401).json({ status: 'error', message: 'Session expired or revoked' });
      return;
    }

    if (!dbSession.user.isActive) {
      res.status(401).json({ status: 'error', message: 'Account disabled' });
      return;
    }

    // 4. Update last seen timestamp asynchronously
    prisma.session.update({
      where: { id: dbSession.id },
      data: { lastSeenAt: new Date() },
    }).catch((err) => console.error('Failed to update session lastSeenAt:', err));

    // 5. Attach authenticated user details to request object
    req.user = {
      userId: dbSession.userId,
      role: dbSession.user.role,
      sessionId: dbSession.id,
      username: dbSession.user.username,
      studentId: dbSession.user.student?.studentId,
    };

    next();
  } catch (err) {
    console.error('Authentication middleware error:', err);
    res.status(401).json({ status: 'error', message: 'Authentication failed' });
  }
};
