import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listActiveConsents,
  grantConsent,
  revoke,
  listBatches,
  approveBatch,
  listHistoryConsents,
  listDoctorConsents,
} from '../controllers/consent.controller';

const router = Router();

router.get('/active', authenticate, listActiveConsents);
router.get('/all', authenticate, listHistoryConsents);
router.get('/history', authenticate, listHistoryConsents);
router.get('/doctor', authenticate, listDoctorConsents);
router.post('/grant', authenticate, grantConsent);
router.post('/revoke', authenticate, revoke);
router.get('/batches', authenticate, listBatches);
router.post('/batch-approve', authenticate, approveBatch);

export default router;
