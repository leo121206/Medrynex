import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase, prisma } from './models/db';

const startServer = async (): Promise<void> => {
  try {
    // Attempt database initialization
    await connectDatabase();

    const server = app.listen(env.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`🚀 Medrynx EHR Backend running at http://localhost:${env.PORT}`);
      logger.info(`🩺 Health Check endpoint: http://localhost:${env.PORT}/api/v1/health`);
      logger.info(`🌐 Environment: ${env.NODE_ENV}`);
      logger.info(`⛓️  Blockchain Ganache RPC: ${env.GANACHE_RPC_URL}`);
      logger.info(`📦 IPFS Gateway: ${env.IPFS_GATEWAY_URL}`);
      logger.info(`=======================================================`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        logger.info('HTTP server closed.');
        await prisma.$disconnect();
        logger.info('Database disconnected.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
// Server reloaded with updated environment configuration
