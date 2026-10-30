import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import {
  getPlatformStats,
  getDoctorVerifications,
  toggleDoctorVerification,
  getPatients,
  getBlockchainMetrics,
  getStorageMetrics,
  getAnomalies,
} from '../controllers/admin.controller';

const router = Router();
const adminOnly = requireRole('ADMIN', 'PLATFORM_ADMIN', 'ORGANIZATION_ADMIN', 'AUDITOR');

router.get('/stats', authenticate, adminOnly, getPlatformStats);
router.get('/doctors', authenticate, adminOnly, getDoctorVerifications);
router.patch('/doctors/:id/status', authenticate, adminOnly, toggleDoctorVerification);
router.get('/patients', authenticate, adminOnly, getPatients);
router.get('/blockchain', authenticate, adminOnly, getBlockchainMetrics);
router.get('/blockchain/metrics', authenticate, adminOnly, getBlockchainMetrics);
router.get('/storage', authenticate, adminOnly, getStorageMetrics);
router.get('/anomalies', authenticate, adminOnly, getAnomalies);

export default router;
