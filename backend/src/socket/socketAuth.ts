import { Socket } from 'socket.io';
import parseCookie from 'cookie';
import { UserRole } from '@prisma/client';
import { verifyAuthToken, AUTH_COOKIE_NAME, AuthTokenPayload } from '../utils/jwt';
import { prisma } from '../config/database';

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
      return next(new Error('Session expired or revoked'));
    }

    if (!dbSession.user.isActive) {
      return next(new Error('User account is disabled'));
    }

    // Attach authenticated user payload to socket.data
    socket.data.user = {
      userId: dbSession.userId,
      role: dbSession.user.role,
      sessionId: dbSession.id,
      username: dbSession.user.username,
      studentId: dbSession.user.student?.studentId,
    };

    next();
  } catch (err: any) {
    console.error('Socket authentication error:', err);
    next(new Error('Socket authentication failed'));
  }
};
