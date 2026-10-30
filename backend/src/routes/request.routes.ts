import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { createRequest, listPatientRequests, listDoctorRequests, listAllRequests, rejectRequest } from '../controllers/request.controller';

const router = Router();

// Doctor requests access
router.post('/create', authenticate, requireRole('DOCTOR'), createRequest);

// Patient views incoming requests
router.get('/patient', authenticate, listPatientRequests);

// Doctor views their submitted requests
router.get('/doctor', authenticate, requireRole('DOCTOR'), listDoctorRequests);

// Patient rejects an access request
router.post('/reject', authenticate, rejectRequest);
router.post('/:id/reject', authenticate, rejectRequest);

// All requests (e.g. for anomaly evaluation / admin)
router.get('/all', authenticate, listAllRequests);

export default router;
