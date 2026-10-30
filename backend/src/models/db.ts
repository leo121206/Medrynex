import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

/**
 * Ensures PostgreSQL connection pooling parameters (connection_limit, pool_timeout, connect_timeout)
 * are present on DATABASE_URL for hosted free-tier PostgreSQL providers (Render, Neon, Supabase).
 */
export function buildPooledDatabaseUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const defaultPoolSize = process.env.DB_POOL_SIZE || (env.NODE_ENV === 'production' ? '10' : '15');
    const defaultPoolTimeout = process.env.DB_POOL_TIMEOUT || '20';
    const defaultConnectTimeout = process.env.DB_CONNECT_TIMEOUT || '10';

    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', defaultPoolSize);
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', defaultPoolTimeout);
    }
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', defaultConnectTimeout);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export const pooledDatabaseUrl = buildPooledDatabaseUrl(env.DATABASE_URL);

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    datasources: {
      db: {
        url: pooledDatabaseUrl,
      },
    },
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export let isDbConnected = false;

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    isDbConnected = true;
    logger.info('Connected to PostgreSQL database successfully (connection pooling enabled)');
  } catch (error) {
    isDbConnected = false;
    logger.warn('Could not establish initial database connection (running in offline/disconnected mode)', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (env.NODE_ENV === 'production' && process.env.STRICT_PROD_ENFORCE === 'true') {
      logger.error('CRITICAL: Production server aborted startup: PostgreSQL database connection could not be established.');
      throw new Error('Database connection failed in production mode with STRICT_PROD_ENFORCE=true');
    }
  }
};
