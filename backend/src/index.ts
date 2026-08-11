import http from 'http';
import { config } from './config/env';
import { createApp } from './app';
import { prisma } from './config/database';
import { initSocketServer } from './socket';

const app = createApp();
const httpServer = http.createServer(app);

// Attach Socket.IO to HTTP server
initSocketServer(httpServer);

let server: http.Server | undefined;

if (process.env.NODE_ENV !== 'test') {
  server = httpServer.listen(config.port, () => {
    console.log(`==================================================`);
    console.log(`Coding Event Platform 2026 Backend Running`);
    console.log(`Environment  : ${config.nodeEnv}`);
    console.log(`Port         : ${config.port}`);
    console.log(`Frontend URL : ${config.frontendUrl}`);
    console.log(`Health Check : http://localhost:${config.port}/health`);
    console.log(`Realtime Socket.IO Enabled`);
    console.log(`==================================================`);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);
    if (server) {
      server.close(async () => {
        console.log('✓ HTTP & Socket.IO server closed.');
        try {
          await prisma.$disconnect();
          console.log('✓ Prisma database connection disconnected.');
        } catch (err) {
          console.error('Error disconnecting database:', err);
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

export { app, httpServer };
