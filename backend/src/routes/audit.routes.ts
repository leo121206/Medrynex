import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listAuditLogs,
  getAuditLog,
  verifyAudit,
  verifyRecord,
  getEntityEvidence,
  getAnalytics,
  listAllUsers,
} from '../controllers/audit.controller';

const router = Router();

router.get('/logs', authenticate, listAuditLogs);
router.get('/logs/:id', authenticate, getAuditLog);
router.get('/logs/:id/verify', authenticate, verifyAudit);
router.get('/records/:id/integrity', authenticate, verifyRecord);
router.get('/evidence/:type/:id', authenticate, getEntityEvidence);
router.get('/analytics', authenticate, getAnalytics);
router.get('/users', authenticate, listAllUsers);

export default router;
