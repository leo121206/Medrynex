import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { validateRequest } from '../middleware/validate';
import {
  aimlSimulationSchema,
  aimlAnomalyQuerySchema,
} from '../validators/aiml.validator';
import {
  getModelHealth,
  getModelInfo,
  simulateScore,
  getAnomalies,
  getSummary,
} from '../controllers/aiml.controller';

const router = Router();

// Liveness & telemetry endpoints
router.get('/health', authenticate, getModelHealth);
router.get('/model-info', authenticate, getModelInfo);

// Simulation endpoint (Zero-PHI access pattern evaluation for clinicians & administrators)
router.post(
  '/simulate',
  authenticate,
  requireRole('DOCTOR', 'ADMIN'),
  validateRequest(aimlSimulationSchema),
  simulateScore
);

// Anomaly inspection & feed with tenant isolation
router.get(
  '/anomalies',
  authenticate,
  validateRequest(aimlAnomalyQuerySchema),
  getAnomalies
);

// Dashboard summary metrics
router.get('/summary', authenticate, getSummary);

export default router;
