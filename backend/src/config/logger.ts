type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'authorization',
  'secret',
  'aessecretkey',
  'jwtsecret',
  'kek',
  'dek',
  'wrappeddek',
  'privatekey',
  'patientname',
  'diagnosis',
  'clinicalnotes',
  'ssn',
  'mrn',
]);

/**
 * Recursively redacts sensitive credentials, keys, and PHI from log metadata objects.
 */
function sanitizeMeta(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact Bearer tokens if caught in raw strings
    if (obj.startsWith('Bearer ')) {
      return 'Bearer [REDACTED]';
    }
    // Redact 64-char hex strings (potential private keys or raw DEKs)
    if (/^[0-9a-fA-F]{64}$/.test(obj)) {
      return '[REDACTED_KEY_HASH]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMeta(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitizeMeta(value, depth + 1);
      }
    }
    return clean;
  }

  return obj;
}

const formatMessage = (level: LogLevel, message: string, meta?: unknown): string => {
  const timestamp = new Date().toISOString();
  const cleanMeta = meta ? sanitizeMeta(meta) : undefined;

  // In production, emit standardized single-line structured JSON logs for log aggregators
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(cleanMeta && typeof cleanMeta === 'object' ? cleanMeta : { meta: cleanMeta }),
    });
  }

  // In development / test, emit human-readable format
  const metaString = cleanMeta ? ` | ${JSON.stringify(cleanMeta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
};

export const logger = {
  info: (message: string, meta?: unknown) => {
    const formatted = formatMessage('info', message, meta);
    if (process.env.NODE_ENV === 'production') {
      console.log(formatted);
    } else {
      console.log(`\x1b[32m${formatted}\x1b[0m`);
    }
  },
  warn: (message: string, meta?: unknown) => {
    const formatted = formatMessage('warn', message, meta);
    if (process.env.NODE_ENV === 'production') {
      console.warn(formatted);
    } else {
      console.warn(`\x1b[33m${formatted}\x1b[0m`);
    }
  },
  error: (message: string, meta?: unknown) => {
    const formatted = formatMessage('error', message, meta);
    if (process.env.NODE_ENV === 'production') {
      console.error(formatted);
    } else {
      console.error(`\x1b[31m${formatted}\x1b[0m`);
    }
  },
  debug: (message: string, meta?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      const formatted = formatMessage('debug', message, meta);
      console.debug(`\x1b[36m${formatted}\x1b[0m`);
    }
  },
};
