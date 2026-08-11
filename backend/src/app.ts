import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import healthRouter from './routes/health.routes';
import authRouter from './routes/auth.routes';
import adminRoundRouter from './routes/adminRound.routes';
import round1Router from './routes/round1.routes';
import round2Router from './routes/round2.routes';
import round3Router from './routes/round3.routes';
import roundsRouter from './routes/rounds.routes';
import competitionRouter from './routes/competition.routes';
import violationRouter from './routes/violation.routes';
import adminStudentRouter from './routes/adminStudent.routes';
import { errorHandler } from './middleware/errorHandler';

export const createApp = (): Express => {
  const app = express();

  // 1. Security HTTP Headers
  app.use(helmet());

  // 2. CORS Configuration dynamically supporting FRONTEND_URL
  const allowedOrigins = [config.frontendUrl, 'http://localhost:3000'].filter(Boolean);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || config.nodeEnv === 'development') {
          callback(null, true);
        } else {
          callback(new Error('CORS request blocked by origin policy'));
        }
      },
      credentials: true,
    })
  );

  // 3. Request Body & Cookie Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 4. API Routes
  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin/rounds', adminRoundRouter);
  app.use('/api/admin/students', adminStudentRouter);
  app.use('/api/rounds', roundsRouter);
  app.use('/api/round1', round1Router);
  app.use('/api/round2', round2Router);
  app.use('/api/round3', round3Router);
  app.use('/api/competition', competitionRouter);
  app.use('/api/violations', violationRouter);

  // 5. Global Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};
