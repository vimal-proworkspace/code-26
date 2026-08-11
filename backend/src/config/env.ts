import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file (root or local)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export interface EnvironmentConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  databaseUrl: string;
  directUrl: string;
  jwtSecret: string;
  frontendUrl: string;
  defaultAdminUsername: string;
  defaultAdminPassword: string;
  defaultStudentPassword: string;
  continuationPassword?: string;
  judge0BaseUrl?: string;
  judge0ApiKey?: string;
}

const parsePort = (val?: string, defaultPort = 4000): number => {
  if (!val) return defaultPort;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultPort : parsed;
};

const getEnvConfig = (): EnvironmentConfig => {
  const nodeEnv = (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development';
  const port = parsePort(process.env.PORT, 4000);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (nodeEnv === 'production') {
    if (!process.env.JWT_SECRET) {
      console.warn('WARNING: JWT_SECRET is not set in production environment configuration!');
    }
    if (!process.env.DATABASE_URL) {
      console.warn('WARNING: DATABASE_URL is not set in production environment configuration!');
    }
  }

  return {
    port,
    nodeEnv,
    databaseUrl: process.env.DATABASE_URL || '',
    directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_placeholder_do_not_use_in_production',
    frontendUrl,
    defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin@it.com',
    defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin@it',
    defaultStudentPassword: process.env.DEFAULT_STUDENT_PASSWORD || 'welcome@sara',
    continuationPassword: process.env.CONTINUATION_PASSWORD,
    judge0BaseUrl: process.env.JUDGE0_BASE_URL,
    judge0ApiKey: process.env.JUDGE0_API_KEY,
  };
};

export const config = getEnvConfig();
