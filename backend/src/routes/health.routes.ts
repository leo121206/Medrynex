import { Router } from 'express';
import { getHealth, getLiveness, getReadiness, getDependencies } from '../controllers/health.controller';

const router = Router();

/**
 * @route   GET /api/v1/health
 * @desc    Comprehensive system health and service connectivity check
 * @access  Public
 */
router.get('/', getHealth);

/**
 * @route   GET /api/v1/health/liveness | /api/v1/health/live
 * @desc    Kubernetes / Render container liveness probe (instant UP response)
 * @access  Public
 */
router.get('/liveness', getLiveness);
router.get('/live', getLiveness);

/**
 * @route   GET /api/v1/health/readiness | /api/v1/health/ready
 * @desc    Kubernetes / container readiness probe (deep dependency checks)
 * @access  Public
 */
router.get('/readiness', getReadiness);
router.get('/ready', getReadiness);

/**
 * @route   GET /api/v1/health/dependencies
 * @desc    Diagnostic health inspection with 4-state taxonomy (HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN)
 * @access  Public / Diagnostics
 */
router.get('/dependencies', getDependencies);

export default router;
