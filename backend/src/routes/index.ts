import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import recordRoutes from './record.routes';
import requestRoutes from './request.routes';
import consentRoutes from './consent.routes';
import emergencyRoutes from './emergency.routes';
import auditRoutes from './audit.routes';
import adminRoutes from './admin.routes';
import fhirRoutes from './fhir.routes';
import relationshipRoutes from './relationship.routes';
import notificationRoutes from './notification.routes';
import aimlRoutes from './aiml.routes';
import metricsRoutes from './metrics.routes';

const router = Router();

// Mount all API v1 routes
router.use('/health', healthRoutes);
router.use('/metrics', metricsRoutes);
router.use('/auth', authRoutes);
router.use('/records', recordRoutes);
router.use('/requests', requestRoutes);
router.use('/consent', consentRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/audit', auditRoutes);
router.use('/admin', adminRoutes);
router.use('/fhir', fhirRoutes);
router.use('/relationships', relationshipRoutes);
router.use('/notifications', notificationRoutes);
router.use('/aiml', aimlRoutes);

export default router;
