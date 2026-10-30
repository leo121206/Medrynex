import { Router } from 'express';
import { register, login, getMe, updateMe, refreshToken, logout } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { ApiResponse } from '../utils/apiResponse';
import { authEndpointLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new patient, doctor, or admin user
 * @access  Public
 */
router.post('/register', authEndpointLimiter, validateRequest(registerSchema), register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return JWT session token
 * @access  Public
 */
router.post('/login', authEndpointLimiter, validateRequest(loginSchema), login);

router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Rotate and refresh JWT access token using valid refresh token
 * @access  Public
 */
router.post('/refresh', authEndpointLimiter, refreshToken);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Revoke refresh token and invalidate active session
 * @access  Public
 */
router.post('/logout', logout);

/**
 * Role-guard test routes for verification
 */
router.get('/test/patient-only', authenticate, requireRole('PATIENT'), (req, res) => {
  ApiResponse.success(res, { user: req.user }, 'Patient access granted');
});

router.get('/test/doctor-only', authenticate, requireRole('DOCTOR'), (req, res) => {
  ApiResponse.success(res, { user: req.user }, 'Doctor access granted');
});

router.get('/test/admin-only', authenticate, requireRole('ADMIN'), (req, res) => {
  ApiResponse.success(res, { user: req.user }, 'Admin access granted');
});

export default router;
