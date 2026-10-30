import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/apiError';

/**
 * Service-to-service authentication middleware.
 * Verifies that requests between internal microservices (e.g. backend, AI/ML, background workers)
 * present a valid internal service key.
 */
export const requireInternalServiceAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const serviceKey =
    req.headers['x-medrynx-internal-key'] ||
    (req.headers.authorization?.startsWith('Internal ')
      ? req.headers.authorization.slice(9)
      : null);

  if (!serviceKey || serviceKey !== env.INTERNAL_SERVICE_KEY) {
    throw ApiError.unauthorized('Internal service authentication failed: Invalid or missing service key.');
  }

  next();
};
