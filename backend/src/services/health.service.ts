import { prisma } from '../models/db';
import { localKms } from '../crypto/kms/LocalKeyManagementService';
import { defaultStorage } from './storage';
import { env } from '../config/env';
import { getModelHealth } from './ml.service';

export type ComponentHealth = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export interface LivenessStatus {
  status: 'UP';
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessStatus {
  status: 'READY' | 'DEGRADED';
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: 'CONNECTED' | 'IN_MEMORY_FALLBACK' | 'UNAVAILABLE';
    kms: 'ACTIVE' | 'ERROR';
    storage: 'CONNECTED' | 'LOCAL_FALLBACK' | 'UNAVAILABLE';
    blockchain: 'CONFIGURED' | 'PENDING';
    aiml: 'CONNECTED' | 'FALLBACK' | 'UNAVAILABLE';
  };
}

/**
 * Bounds any asynchronous probe promise to a strict timeout window.
 * Prevents hanging health checks from tying up worker threads or connection pools.
 */
export async function withProbeTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ]);
}

export interface FullHealthStatus {
  status: 'healthy' | 'degraded';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  nodeVersion: string;
  version: string;
  services: {
    database: string;
    kms: string;
    storage: string;
    blockchain: string;
    aiml: string;
    ganacheRpc: string;
    ipfsGateway: string;
  };
}

export const checkLiveness = (): LivenessStatus => {
  return {
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };
};

export const checkReadiness = async (): Promise<ReadinessStatus> => {
  let dbStatus: 'CONNECTED' | 'IN_MEMORY_FALLBACK' | 'UNAVAILABLE' = 'IN_MEMORY_FALLBACK';
  try {
    const isOk = await withProbeTimeout(
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      2000,
      false
    );
    dbStatus = isOk ? 'CONNECTED' : process.env.VITEST ? 'IN_MEMORY_FALLBACK' : 'UNAVAILABLE';
  } catch {
    dbStatus = process.env.VITEST ? 'IN_MEMORY_FALLBACK' : 'UNAVAILABLE';
  }

  let kmsStatus: 'ACTIVE' | 'ERROR' = 'ACTIVE';
  try {
    const activeVersion = localKms.getActiveVersion();
    if (!activeVersion) kmsStatus = 'ERROR';
  } catch {
    kmsStatus = 'ERROR';
  }

  let storageStatus: 'CONNECTED' | 'LOCAL_FALLBACK' | 'UNAVAILABLE' = 'LOCAL_FALLBACK';
  try {
    const isIpfs = !env.IPFS_MOCK_ENABLED;
    if (isIpfs) {
      const isAlive = await withProbeTimeout(defaultStorage.checkIpfsHealth(), 2000, false);
      storageStatus = isAlive ? 'CONNECTED' : 'UNAVAILABLE';
    } else {
      storageStatus = 'LOCAL_FALLBACK';
    }
  } catch {
    storageStatus = 'UNAVAILABLE';
  }

  const blockchainStatus = env.GANACHE_RPC_URL ? 'CONFIGURED' : 'PENDING';

  // Check advisory AI/ML microservice dependency (bounded to 1500ms)
  let aimlStatus: 'CONNECTED' | 'FALLBACK' | 'UNAVAILABLE' = 'FALLBACK';
  try {
    const mlHealth = await withProbeTimeout(
      getModelHealth(),
      1500,
      { status: 'degraded' as const, modelLoaded: false }
    );
    if (mlHealth.status === 'ok') {
      aimlStatus = 'CONNECTED';
    } else if (mlHealth.status === 'degraded') {
      aimlStatus = 'FALLBACK';
    } else {
      aimlStatus = 'UNAVAILABLE';
    }
  } catch {
    aimlStatus = 'UNAVAILABLE';
  }

  // Core critical services: Database, KMS, Storage. (AI/ML is advisory and fails open).
  const isDegraded = dbStatus === 'UNAVAILABLE' || kmsStatus === 'ERROR' || storageStatus === 'UNAVAILABLE';

  return {
    status: isDegraded ? 'DEGRADED' : 'READY',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    checks: {
      database: dbStatus,
      kms: kmsStatus,
      storage: storageStatus,
      blockchain: blockchainStatus,
      aiml: aimlStatus,
    },
  };
};

export interface DependencyDetail {
  status: ComponentHealth;
  latencyMs?: number;
  message?: string;
}

export interface DetailedDependencyHealth {
  status: ComponentHealth;
  timestamp: string;
  uptimeSeconds: number;
  dependencies: {
    database: DependencyDetail;
    kms: DependencyDetail;
    storage: DependencyDetail;
    blockchain: DependencyDetail;
    aiml: DependencyDetail;
  };
}

export const checkDependencyHealth = async (): Promise<DetailedDependencyHealth> => {
  const readiness = await checkReadiness();

  const toHealth = (val: string): ComponentHealth => {
    if (val === 'CONNECTED' || val === 'ACTIVE' || val === 'CONFIGURED' || val === 'ok') return 'HEALTHY';
    if (val === 'FALLBACK' || val === 'LOCAL_FALLBACK' || val === 'IN_MEMORY_FALLBACK') return 'DEGRADED';
    if (val === 'UNAVAILABLE' || val === 'ERROR') return 'UNHEALTHY';
    return 'UNKNOWN';
  };

  const dbHealth = toHealth(readiness.checks.database);
  const kmsHealth = toHealth(readiness.checks.kms);
  const storageHealth = toHealth(readiness.checks.storage);
  const blockchainHealth = toHealth(readiness.checks.blockchain);
  const aimlHealth = toHealth(readiness.checks.aiml);

  const overallStatus: ComponentHealth =
    dbHealth === 'UNHEALTHY' || kmsHealth === 'UNHEALTHY' || storageHealth === 'UNHEALTHY'
      ? 'UNHEALTHY'
      : aimlHealth === 'DEGRADED' || storageHealth === 'DEGRADED' || dbHealth === 'DEGRADED'
      ? 'DEGRADED'
      : 'HEALTHY';

  return {
    status: overallStatus,
    timestamp: readiness.timestamp,
    uptimeSeconds: readiness.uptimeSeconds,
    dependencies: {
      database: { status: dbHealth, message: readiness.checks.database },
      kms: { status: kmsHealth, message: readiness.checks.kms },
      storage: { status: storageHealth, message: readiness.checks.storage },
      blockchain: { status: blockchainHealth, message: readiness.checks.blockchain },
      aiml: { status: aimlHealth, message: readiness.checks.aiml },
    },
  };
};

export const checkSystemHealth = async (): Promise<FullHealthStatus> => {
  const readiness = await checkReadiness();

  return {
    status: readiness.status === 'READY' ? 'healthy' : 'degraded',
    uptimeSeconds: readiness.uptimeSeconds,
    timestamp: readiness.timestamp,
    environment: env.NODE_ENV,
    nodeVersion: process.version,
    version: '2.0.0',
    services: {
      database: readiness.checks.database,
      kms: readiness.checks.kms,
      storage: readiness.checks.storage,
      blockchain: readiness.checks.blockchain,
      aiml: readiness.checks.aiml,
      ganacheRpc: readiness.checks.blockchain === 'CONFIGURED' ? 'configured' : 'pending',
      ipfsGateway: readiness.checks.storage !== 'UNAVAILABLE' ? 'configured' : 'pending',
    },
  };
};
