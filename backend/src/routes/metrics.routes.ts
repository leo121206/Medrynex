import { Router, Request, Response, NextFunction } from 'express';
import { metricsRegistry } from '../services/metrics.service';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { env } from '../config/env';
import { ApiError } from '../utils/apiError';

const router = Router();

/**
 * Access guard: Permitted if caller has ADMIN role JWT or presents valid X-Medrynx-Internal-Key
 */
const metricsAccessGuard = (req: Request, res: Response, next: NextFunction): void => {
  const internalKey = req.headers['x-medrynx-internal-key'];
  if (internalKey && internalKey === env.INTERNAL_SERVICE_KEY) {
    return next();
  }

  // Fall back to Bearer token authentication with ADMIN role requirement
  authenticate(req, res, (authErr) => {
    if (authErr) {
      return next(ApiError.unauthorized('Authentication required to access platform telemetry metrics.'));
    }
    requireRole('ADMIN')(req, res, (roleErr) => {
      if (roleErr) {
        return next(ApiError.forbidden('Forbidden: Telemetry metrics restricted to platform administrators.'));
      }
      next();
    });
  });
};

/**
 * @route   GET /api/v1/metrics
 * @desc    Protected metrics endpoint exporting Prometheus text or JSON telemetry
 * @access  Private (ADMIN or Internal Service Key)
 */
router.get('/', metricsAccessGuard, (req: Request, res: Response) => {
  const acceptHeader = req.headers['accept'] || '';

  if (acceptHeader.includes('text/plain') || req.query.format === 'prometheus') {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metricsRegistry.getPrometheusFormat());
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      success: true,
      data: metricsRegistry.getMetricsJson(),
    });
  }
});

export default router;
