import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  triggerEmergency,
  getActiveEmergencies,
  revokeEmergency,
  listEmergencyHistory,
  reconcileEmergency,
  disputeEmergency,
  listDisputes,
} from '../controllers/emergency.controller';

const router = Router();

router.post('/declare', authenticate, triggerEmergency);
router.get('/active', authenticate, getActiveEmergencies);
router.post('/revoke', authenticate, revokeEmergency);
router.get('/history', authenticate, listEmergencyHistory);
router.post('/reconcile', authenticate, reconcileEmergency);
router.post('/dispute', authenticate, disputeEmergency);
router.get('/disputes', authenticate, listDisputes);

export default router;
