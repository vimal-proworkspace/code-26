import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { config } from '../config/env';

export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
  sessionId: string;
}

export const AUTH_COOKIE_NAME = 'auth_token';
const TOKEN_EXPIRATION_HOURS = 24;

/**
 * Signs a JWT with non-sensitive user identity payloads.
 */
export const signAuthToken = (payload: AuthTokenPayload): string => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: `${TOKEN_EXPIRATION_HOURS}h`,
  });
};

/**
 * Verifies and decodes a JWT using the server JWT_SECRET.
 */
export const verifyAuthToken = (token: string): AuthTokenPayload => {
  return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
};

/**
 * Sets the secure HTTP-Only authentication cookie on the response.
 */
export const setAuthCookie = (res: Response, token: string): void => {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000,
    path: '/',
  });
};

/**
 * Clears the HTTP-Only authentication cookie.
 */
export const clearAuthCookie = (res: Response): void => {
  res.cookie(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  });
};
