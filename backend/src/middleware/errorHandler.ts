import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const isProduction = config.nodeEnv === 'production';

  // Internal logging for diagnostics
  console.error(`[ERROR] ${req.method} ${req.path} - Status ${statusCode}:`, err.message);
  if (!isProduction && err.stack) {
    console.error(err.stack);
  }

  // Response output sanitization
  const responsePayload = {
    status: 'error',
    message: isProduction && statusCode === 500 ? 'Internal server error' : err.message || 'An error occurred',
    ...(isProduction ? {} : { details: err.details, stack: err.stack }),
  };

  res.status(statusCode).json(responsePayload);
};
