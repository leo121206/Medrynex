import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app';
import { prisma } from '../models/db';
import { signToken } from '../utils/jwt';
import { UserRole, DoctorVerificationStatus } from '@prisma/client';

// Mock the prisma model functions
vi.mock('../models/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
  connectDatabase: vi.fn(),
  isDbConnected: true,
}));

describe('Auth Module (/api/v1/auth)', () => {
  const mockPasswordHash = bcrypt.hashSync('Password123!', 10);

  const mockPatientUser = {
    id: 'pt-uuid-001',
    name: 'Karna Sharma',
    email: 'karna.test@medrynx.org',
    passwordHash: mockPasswordHash,
    role: UserRole.PATIENT,
    phone: '+91 98765 43210',
    avatarUrl: null,
    patientId: 'PT-98234',
    dob: '1988-03-14',
    gender: 'Male',
    bloodGroup: 'O+',
    doctorId: null,
    licenseId: null,
    specialization: null,
    hospital: null,
    verificationStatus: null,
    adminId: null,
    department: null,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: new Date(),
  };

  const mockDoctorUser = {
    id: 'doc-uuid-002',
    name: 'Dr. Ananya Sharma',
    email: 'ananya.test@medrynx.org',
    passwordHash: mockPasswordHash,
    role: UserRole.DOCTOR,
    phone: '+91 98111 22233',
    avatarUrl: null,
    patientId: null,
    dob: null,
    gender: null,
    bloodGroup: null,
    doctorId: 'd-201',
    licenseId: 'MCI-2019-94821',
    specialization: 'Cardiology',
    hospital: 'ABC Hospital',
    verificationStatus: DoctorVerificationStatus.PENDING,
    adminId: null,
    department: null,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new patient successfully with role-specific fields', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockPatientUser);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Karna Sharma',
          email: 'karna.test@medrynx.org',
          password: 'Password123!',
          role: 'PATIENT',
          phone: '+91 98765 43210',
          dob: '1988-03-14',
          gender: 'Male',
          bloodGroup: 'O+',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user).toMatchObject({
        name: 'Karna Sharma',
        email: 'karna.test@medrynx.org',
        role: 'PATIENT',
        patientId: 'PT-98234',
        bloodGroup: 'O+',
      });
      // Ensure passwordHash is omitted
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should register a new doctor with clinical fields and PENDING verification', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockDoctorUser);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Dr. Ananya Sharma',
          email: 'ananya.test@medrynx.org',
          password: 'Password123!',
          role: 'DOCTOR',
          specialization: 'Cardiology',
          hospital: 'ABC Hospital',
          licenseId: 'MCI-2019-94821',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        name: 'Dr. Ananya Sharma',
        email: 'ananya.test@medrynx.org',
        role: 'DOCTOR',
        specialization: 'Cardiology',
        hospital: 'ABC Hospital',
        verificationStatus: 'PENDING',
      });
    });

    it('should return 409 Conflict if email is already registered', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPatientUser);

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Another User',
          email: 'karna.test@medrynx.org',
          password: 'Password123!',
          role: 'PATIENT',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CONFLICT');
    });

    it('should return 400 Bad Request on invalid email or short password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'Bad Input',
          email: 'not-an-email',
          password: '123',
          role: 'PATIENT',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should authenticate user and return JWT token on valid credentials', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPatientUser);
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockPatientUser,
        lastLogin: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'karna.test@medrynx.org',
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('karna.test@medrynx.org');
    });

    it('should return 401 Unauthorized for incorrect password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPatientUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'karna.test@medrynx.org',
          password: 'WrongPassword!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 Unauthorized for non-existent email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@medrynx.org',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 Unauthorized on role mismatch', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPatientUser);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'karna.test@medrynx.org',
          password: 'Password123!',
          role: 'DOCTOR', // User is actually PATIENT
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('JWT Verification & Protected Routes', () => {
    it('should return 401 Unauthorized when accessing /me without token', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return user profile on /me with valid JWT token', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPatientUser);

      const token = signToken({
        id: mockPatientUser.id,
        email: mockPatientUser.email,
        role: mockPatientUser.role,
        patientId: mockPatientUser.patientId,
      });

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('karna.test@medrynx.org');
    });

    it('should enforce role guards: block patient from doctor-only route (403)', async () => {
      const patientToken = signToken({
        id: mockPatientUser.id,
        email: mockPatientUser.email,
        role: 'PATIENT',
        patientId: mockPatientUser.patientId,
      });

      const response = await request(app)
        .get('/api/v1/auth/test/doctor-only')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should enforce role guards: allow doctor to access doctor-only route (200)', async () => {
      const doctorToken = signToken({
        id: mockDoctorUser.id,
        email: mockDoctorUser.email,
        role: 'DOCTOR',
        doctorId: mockDoctorUser.doctorId,
        hospital: mockDoctorUser.hospital,
      });

      const response = await request(app)
        .get('/api/v1/auth/test/doctor-only')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('DOCTOR');
    });

    it('should enforce role guards: allow patient to access patient-only route (200)', async () => {
      const patientToken = signToken({
        id: mockPatientUser.id,
        email: mockPatientUser.email,
        role: 'PATIENT',
        patientId: mockPatientUser.patientId,
      });

      const response = await request(app)
        .get('/api/v1/auth/test/patient-only')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 Unauthorized when access token has expired', async () => {
      const expiredToken = signToken(
        {
          id: mockPatientUser.id,
          email: mockPatientUser.email,
          role: mockPatientUser.role,
        },
        -10
      );

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('expired');
    });

    it('should return 401 Unauthorized when access token signature is tampered or malformed', async () => {
      const validToken = signToken({
        id: mockPatientUser.id,
        email: mockPatientUser.email,
        role: mockPatientUser.role,
      });
      const tamperedToken = validToken.slice(0, -6) + 'xxxxxx';

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid authentication token');
    });
  });

  describe('Refresh Token Lifecycle (/api/v1/auth/refresh & /api/v1/auth/logout)', () => {
    it('should return 400 Bad Request if refreshToken is missing from request body', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should rotate valid refresh token and return new access + refresh token', async () => {
      const rawToken = 'mock-raw-refresh-token-40chars-hex-string-01';
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'rt-uuid-001',
        userId: mockPatientUser.id,
        tokenHash,
        deviceId: 'device-test-1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(prisma.refreshToken.update).mockResolvedValue({} as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPatientUser);

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(mockPatientUser.email);
    });

    it('should reject reused or already-revoked refresh token with 401 Unauthorized', async () => {
      const rawToken = 'mock-revoked-token-hex-02';
      const crypto = await import('crypto');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'rt-uuid-002',
        userId: mockPatientUser.id,
        tokenHash,
        deviceId: 'device-test-1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rawToken });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('revoked');
    });

    it('should revoke refresh token on logout', async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 1 } as any);

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'some-active-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ loggedOut: true });
    });
  });

  describe('Account Lockout & Brute-Force Protection', () => {
    const lockTestEmail = 'lockout.target@medrynx.org';

    beforeEach(async () => {
      const { clearFailedLogin } = await import('../services/auth.service');
      clearFailedLogin(lockTestEmail);
    });

    it('should lock account after 5 consecutive failed login attempts (403 Forbidden)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPatientUser);

      // 4 failed attempts should yield 401
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: lockTestEmail, password: 'WrongPassword!' });
        expect(res.status).toBe(401);
      }

      // 5th failed attempt should trigger lockout threshold
      const res5 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: lockTestEmail, password: 'WrongPassword!' });
      expect(res5.status).toBe(401);

      // 6th attempt should be blocked by checkAccountLockout with 403 Forbidden
      const res6 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: lockTestEmail, password: 'Password123!' });
      expect(res6.status).toBe(403);
      expect(res6.body.error.message).toContain('Account temporarily locked');
    });

    it('should reset failed login count on successful authentication', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockPatientUser,
        email: lockTestEmail,
      });
      vi.mocked(prisma.user.update).mockResolvedValue({
        ...mockPatientUser,
        email: lockTestEmail,
        lastLogin: new Date(),
      });

      // 2 failed attempts
      for (let i = 0; i < 2; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: lockTestEmail, password: 'WrongPassword!' });
      }

      // Successful login resets tracker
      const resSuccess = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: lockTestEmail, password: 'Password123!' });
      expect(resSuccess.status).toBe(200);

      // Next attempt with wrong password is 1st failure, not locked out
      const nextRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: lockTestEmail, password: 'WrongPassword!' });
      expect(nextRes.status).toBe(401);
    });
  });
});
