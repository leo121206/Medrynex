import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/apiError';
import { logger } from '../config/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error | ApiError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const requestId = req.id || (typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined);

  logger.error(`Error processing ${req.method} ${req.originalUrl}: ${err.message}`, {
    requestId,
    stack: err.stack,
  });

  // Handle custom ApiError
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        requestId,
        ...(err.details ? { details: err.details } : {}),
        ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
      },
    });
    return;
  }

  // Handle Zod schema validation errors
  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed schema validation',
        requestId,
        details: formattedIssues,
      },
    });
    return;
  }

  // Prisma known errors
  if ('code' in err && typeof (err as { code: unknown }).code === 'string') {
    const prismaCode = (err as { code: string }).code;
    if (prismaCode === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with this value already exists.',
          requestId,
        },
      });
      return;
    }
    if (prismaCode === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'RECORD_NOT_FOUND',
          message: 'The requested record does not exist.',
          requestId,
        },
      });
      return;
    }
  }

  // Generic 500 unhandled errors (do not leak stack or internal details in non-dev)
  const isDev = env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message : 'An unexpected internal error occurred. Please try again later.',
      requestId,
      ...(isDev ? { stack: err.stack } : {}),
    },
  });
};
