import { PrismaClient } from '@prisma/client';

declare global {
  // Prevent multiple instances of Prisma Client in development during hot-reloading
  // eslint-disable-next-line no-var
  var prismaSingleton: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaSingleton ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaSingleton = prisma;
}

export interface DatabaseStatus {
  connected: boolean;
  status: 'connected' | 'unavailable';
}

export const checkDatabaseConnection = async (): Promise<DatabaseStatus> => {
  try {
    // Perform a simple 1 query to test PostgreSQL connectivity
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      status: 'connected',
    };
  } catch (err) {
    // Log the error internally without exposing credentials externally
    console.error('Database connection check failed:', err instanceof Error ? err.message : err);
    return {
      connected: false,
      status: 'unavailable',
    };
  }
};
