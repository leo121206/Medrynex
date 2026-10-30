import { Request, Response, NextFunction } from 'express';
import { metricsRegistry } from '../services/metrics.service';

/**
 * Express middleware to automatically track request counts and durations.
 * Sanitizes URLs to avoid high-cardinality label explosions.
 */
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path || req.originalUrl;
    metricsRegistry.recordHttpRequest(req.method, route, res.statusCode, duration);
  });

  next();
};
