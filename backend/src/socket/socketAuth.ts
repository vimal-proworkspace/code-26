import { Socket } from 'socket.io';
import * as parseCookie from 'cookie';
import { UserRole, DbSession } from '../config/types';
import { verifyAuthToken, AUTH_COOKIE_NAME, AuthTokenPayload } from '../utils/jwt';
import { queryOne } from '../config/database';

export interface AuthenticatedSocketUser {
  userId: string;
  role: UserRole;
  sessionId: string;
  username?: string;
  studentId?: string;
}

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthenticatedSocketUser;
  };
}

export const socketAuthMiddleware = async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    let token: string | undefined;

    // 1. Try extracting token from handshake cookies
    const cookieHeader = socket.handshake.headers.cookie;
    if (cookieHeader) {
      const parsed = parseCookie.parse(cookieHeader);
      token = parsed[AUTH_COOKIE_NAME];
    }

    // 2. Fallback to handshake auth token or authorization header
    if (!token && socket.handshake.auth?.token) {
      token = socket.handshake.auth.token;
    }

    if (!token && socket.handshake.headers.authorization?.startsWith('Bearer ')) {
      token = socket.handshake.headers.authorization.substring(7);
    }

    if (!token) {
      return next(new Error('Authentication token required for Socket connection'));
    }

    // 3. Verify JWT token
    let payload: AuthTokenPayload;
    try {
      payload = verifyAuthToken(token);
    } catch {
      return next(new Error('Invalid or expired Socket authentication token'));
    }

    // 4. Verify session in PostgreSQL database
    const dbSession = await queryOne<DbSession & { user_id: string; user_role: UserRole; user_username: string; user_isActive: boolean; student_studentId: string | null; isRevoked: boolean }>(
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
      return next(new Error('Session expired or revoked'));
    }

    if (!dbSession.user_isActive) {
      return next(new Error('User account is disabled'));
    }

    // Attach authenticated user payload to socket.data
    socket.data.user = {
      userId: dbSession.userId,
      role: dbSession.user_role,
      sessionId: dbSession.id,
      username: dbSession.user_username,
      studentId: dbSession.student_studentId || undefined,
    };

    next();
  } catch (err: any) {
    console.error('Socket authentication error:', err);
    next(new Error('Socket authentication failed'));
  }
};
