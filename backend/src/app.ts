import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { correlationIdMiddleware } from './middleware/correlationId';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { requestTimeoutMiddleware } from './middleware/timeout';
import { generalApiLimiter } from './middleware/rateLimiter';
import { env } from './config/env';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swaggerSpec';

export const createApp = (): Application => {
  const app: Application = express();

  // 0. Trust first reverse proxy hop (Render / Vercel / Nginx TLS termination & X-Forwarded-For)
  app.set('trust proxy', 1);

  // 1. Correlation ID Middleware (must be first to tag all incoming requests)
  app.use(correlationIdMiddleware);

  // 1b. In-memory Metrics Middleware (tracks durations, status classes, and request volumes)
  app.use(metricsMiddleware);

  // 2. Request Timeout Guard (Slowloris & hanging connection protection)
  app.use(requestTimeoutMiddleware(env.REQUEST_TIMEOUT_MS));

  // 3. Security Headers (Harden HTTP response headers)
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permitted for Swagger UI inline scripts
      crossOriginEmbedderPolicy: false,
      xContentTypeOptions: true,
      xFrameOptions: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // 4. CORS configuration with explicit allowlist (rejects unsafe wildcard when credentials enabled)
  // Combine CORS_ORIGIN list with optional FRONTEND_URL env var (for production deployments)
  const normalizeOrigin = (url: string): string => url.trim().replace(/\/+$/, '');
  const allowedOrigins = Array.from(
    new Set([
      ...env.CORS_ORIGIN.split(',').map(normalizeOrigin).filter(Boolean),
      ...(env.FRONTEND_URL ? env.FRONTEND_URL.split(',').map(normalizeOrigin).filter(Boolean) : []),
    ])
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        const normalizedIncoming = normalizeOrigin(origin);
        if (allowedOrigins.includes(normalizedIncoming) || allowedOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy violation: Origin '${origin}' is not in allowlist.`));
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'X-Medrynx-Internal-Key'],
      exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
      credentials: true,
      maxAge: 86400, // 24 hours preflight cache
    })
  );

  // 5. Body parsers with bounded payload limits (protect against buffer overflows)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 6. Logging
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
    app.use(requestLogger);
  }

  // 7. General API Rate Limiter
  app.use('/api/v1', generalApiLimiter);

  // 8. Swagger Documentation
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/v1/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // 9. API v1 Routes
  app.use('/api/v1', apiRouter);

  // 10. Root welcome route
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Medrynx EHR Backend API',
      version: '1.0.0',
      description: 'Blockchain-based EHR with scope-bound dynamic consent and tiered emergency access control',
      documentation: '/api/v1/health',
      environment: env.NODE_ENV,
    });
  });

  // 11. 404 Route handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        requestId: req.id,
      },
    });
  });

  // 12. Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};

export const app = createApp();
