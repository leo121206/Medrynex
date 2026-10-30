import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = req.startTime || Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const meta = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: status,
      durationMs: duration,
    };

    const logMsg = `${req.method} ${req.originalUrl} [${status}] - ${duration}ms (req-id: ${req.id || 'none'})`;

    if (status >= 500) {
      logger.error(logMsg, meta);
    } else if (status >= 400) {
      logger.warn(logMsg, meta);
    } else {
      logger.info(logMsg, meta);
    }
  });

  next();
};
