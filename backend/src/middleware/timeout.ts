import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Middleware that guards against hanging requests and Slowloris denial of service attacks.
 * If processing exceeds the timeout threshold, terminates connection with HTTP 504 Gateway Timeout.
 */
export const requestTimeoutMiddleware = (timeoutMs: number = env.REQUEST_TIMEOUT_MS || 15000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip timeout in test environment unless explicitly specified
    if (env.NODE_ENV === 'test' && !req.headers['x-test-timeout']) {
      return next();
    }

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: `Request processing exceeded timeout threshold of ${timeoutMs}ms.`,
            requestId: req.id,
          },
        });
      }
    }, timeoutMs);

    // Cancel timer when response finishes
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};
