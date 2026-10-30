import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

interface RateLimitEntry {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipInTest?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Creates an in-memory sliding-window rate limiter middleware.
 * Zero external dependencies; protects against credential stuffing, brute force, and DoS.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    skipInTest = true,
    keyGenerator = (req: Request) => {
      // Use client IP or authenticated user ID
      const forwarded = req.headers['x-forwarded-for'];
      const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress) || '127.0.0.1';
      return req.user?.id ? `user:${req.user.id}` : `ip:${ip}`;
    },
  } = options;

  const store = new Map<string, RateLimitEntry>();

  // Background cleanup every 2 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, Math.max(60000, windowMs * 2));

  // Ensure timer does not prevent process termination
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Optionally skip in test environments unless explicitly tested
    if (skipInTest && env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Retain only requests within current sliding window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    const currentCount = entry.timestamps.length;
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const oldestTimestamp = entry.timestamps[0] || now;
    const resetTimeSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    res.setHeader('RateLimit-Limit', maxRequests);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetTimeSeconds);

    if (currentCount >= maxRequests) {
      res.setHeader('Retry-After', resetTimeSeconds);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfterSeconds: resetTimeSeconds,
        },
      });
      return;
    }

    entry.timestamps.push(now);
    next();
  };
}

// Pre-configured rate limiters
export const generalApiLimiter = createRateLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS || 60000,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS || 300,
  message: 'API rate limit exceeded. Please wait before making more requests.',
});

export const authEndpointLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: env.AUTH_RATE_LIMIT_MAX || 20,
  message: 'Too many authentication attempts. Account access temporarily throttled.',
});

export const heavyOperationsLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 30,
  message: 'Rate limit for resource-intensive cryptographic operations exceeded.',
});
