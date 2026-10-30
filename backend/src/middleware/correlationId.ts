import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

/**
 * Middleware that assigns a unique request correlation ID to every incoming request.
 * Preserves upstream X-Request-Id header if provided, otherwise generates a fresh UUIDv4.
 * Attaches the ID to request object and response headers for distributed tracing and audit correlation.
 */
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const existingId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const requestId = (typeof existingId === 'string' && existingId.trim().length > 0)
    ? existingId.trim()
    : crypto.randomUUID();

  req.id = requestId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', requestId);
  next();
};
