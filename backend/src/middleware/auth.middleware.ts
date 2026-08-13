import { Request, Response, NextFunction } from 'express';
import { UserRole, DbSession, DbUser, DbStudent } from '../config/types';
import { verifyAuthToken, AUTH_COOKIE_NAME, AuthTokenPayload } from '../utils/jwt';
import { queryOne, query } from '../config/database';
import { SQL } from '../config/schemaSql';
export { requireRole } from './role.middleware';

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
    const dbSession = await queryOne<DbSession & { user_id: string; user_role: UserRole; user_username: string; user_isActive: boolean; student_studentId: string | null }>(
      `SELECT s.id, s."userId", s."tokenJti" AS "sessionToken", s."createdAt", s."expiresAt",
              s."revokedAt", s."isRevoked", s."updatedAt" AS "lastSeenAt",
              u.id as user_id, u.role as user_role, u.username as user_username, u."isActive" as "user_isActive",
              u."studentId" as "student_studentId"
       FROM sessions s
       JOIN users u ON u.id = s."userId"
       WHERE s.id = $1`,
      [payload.sessionId]
    );

    if (!dbSession || dbSession.isRevoked || dbSession.revokedAt || new Date(dbSession.expiresAt) < new Date()) {
      res.status(401).json({ status: 'error', message: 'Session expired or revoked' });
      return;
    }

    if (!dbSession.user_isActive) {
      res.status(401).json({ status: 'error', message: 'Account disabled' });
      return;
    }

    // 4. Update last seen timestamp asynchronously
    query(
      `UPDATE sessions SET "updatedAt" = NOW() WHERE id = $1`,
      [dbSession.id]
    ).catch((err) => console.error('Failed to update session lastSeenAt:', err));

    // 5. Attach authenticated user details to request object
    req.user = {
      userId: dbSession.userId,
      role: dbSession.user_role,
      sessionId: dbSession.id,
      username: dbSession.user_username,
      studentId: dbSession.student_studentId || undefined,
    };

    next();
  } catch (err) {
    console.error('Authentication middleware error:', err);
    res.status(401).json({ status: 'error', message: 'Authentication failed' });
  }
};
