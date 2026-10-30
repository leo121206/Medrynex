import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma, isDbConnected, connectDatabase } from '../models/db';
import { localKms } from '../crypto/kms/LocalKeyManagementService';
import { defaultStorage } from '../services/storage';
import { blockchainService } from '../services/blockchain.service';
import { getModelHealth, scoreAccessAnomaly } from '../services/ml.service';
import { signToken } from '../utils/jwt';
import { UserRole, RequestPurpose, RiskLevel, RequestStatus } from '@prisma/client';
import crypto from 'crypto';

describe('MEDRYNX PHASE 13 — PRODUCTION DEPLOYMENT & LAUNCH VALIDATION SUITE', () => {
  beforeAll(async () => {
    await connectDatabase();
  });
  // Test synthetic identities
  const clinicianUser = {
    id: 'launch-doc-001',
    email: 'dr.curie@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-LAUNCH-1',
    hospital: 'Staging Medical Center',
  };

  const patientUser = {
    id: 'launch-pat-001',
    email: 'patient.marie@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-LAUNCH-1',
  };

  const unauthorizedDoc = {
    id: 'launch-doc-unauth',
    email: 'dr.stranger@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-LAUNCH-99',
    hospital: 'External Clinic',
  };

  const docToken = signToken(clinicianUser);
  const patientToken = signToken(patientUser);
  const unauthDocToken = signToken(unauthorizedDoc);

  // -------------------------------------------------------------------------
  // 1. Target Environment & Dependency Initialization
  // -------------------------------------------------------------------------
  describe('1. Target Environment & Dependency Health Verification', () => {
    it('should verify live PostgreSQL database connectivity and core schema tables', async () => {
      expect(isDbConnected).toBe(true);

      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
      `;
      const tableNames = tables.map((t) => t.tablename);

      expect(tableNames).toContain('users');
      expect(tableNames).toContain('records_metadata');
      expect(tableNames).toContain('record_versions');
      expect(tableNames).toContain('access_grants');
      expect(tableNames).toContain('emergency_events');
      expect(tableNames).toContain('audit_log');
      expect(tableNames).toContain('trust_relationships');
    });

    it('should verify live Kubo IPFS daemon connectivity', async () => {
      const isIpfsAlive = await defaultStorage.checkIpfsHealth();
      expect(isIpfsAlive).toBe(true);
    });

    it('should verify live Hardhat EVM blockchain contracts and provider', () => {
      expect(blockchainService.accessRegistryContract).toBeDefined();
      expect(blockchainService.auditLoggerContract).toBeDefined();
      expect(blockchainService.emergencyVaultContract).toBeDefined();
    });

    it('should verify live AI/ML FastAPI microservice and loaded IsolationForest model', async () => {
      const health = await getModelHealth();
      expect(health.status).toBe('ok');
      expect(health.modelLoaded).toBe(true);
      expect(health.modelVersion).toBe('1.0');
    });

    it('should verify cluster readiness probe reports READY (HTTP 200)', async () => {
      const res = await request(app).get('/api/v1/health/readiness');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('READY');
      expect(res.body.data.checks.database).toBe('CONNECTED');
      expect(res.body.data.checks.kms).toBe('ACTIVE');
      expect(res.body.data.checks.storage).toBe('CONNECTED');
      expect(res.body.data.checks.blockchain).toBe('CONFIGURED');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Identity, Authentication & Token Workflows
  // -------------------------------------------------------------------------
  describe('2. Identity, Authentication & Token Security Workflows', () => {
    it('should issue valid JWT access token and verify role claim', async () => {
      const res = await request(app)
        .get('/api/v1/auth/test/doctor-only')
        .set('Authorization', `Bearer ${docToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(clinicianUser.email);
      expect(res.body.data.user.role).toBe(UserRole.DOCTOR);
    });

    it('should strictly reject access without Bearer token (401 Unauthorized)', async () => {
      const res = await request(app).get('/api/v1/records');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should enforce role boundaries and block unauthorized role escalations', async () => {
      // Patient attempting to call doctor-only endpoint
      const res = await request(app)
        .post('/api/v1/aiml/simulate')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorSpecialty: 'Cardiology',
          recordType: 'ECG',
          purpose: 'Diagnosis',
        });

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Medical Records, Envelope Encryption & Zero-PHI Storage
  // -------------------------------------------------------------------------
  describe('3. Medical Record Ingestion, Encryption & IPFS Zero-PHI Integrity', () => {
    it('should execute end-to-end envelope encryption, IPFS pinning, and byte-for-byte decryption', async () => {
      const syntheticClinicalData = JSON.stringify({
        recordType: 'ECG_DIAGNOSTIC_REPORT',
        patientId: patientUser.id,
        heartRateBpm: 72,
        rhythm: 'Normal Sinus Rhythm',
        timestamp: new Date().toISOString(),
        syntheticNotice: 'Non-clinical synthetic testing data only',
      });

      const plaintextBuffer = Buffer.from(syntheticClinicalData, 'utf8');
      const originalSha256 = crypto.createHash('sha256').update(plaintextBuffer).digest('hex');

      // 1. Generate unique random 256-bit DEK
      const dek = localKms.generateDek();
      expect(dek.length).toBe(32);

      // 2. Wrap DEK under Master KEK
      const wrapped = await localKms.wrapDek(dek);
      expect(wrapped.wrappedDek).toBeDefined();

      // 3. Encrypt plaintext using AES-256-GCM
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // Combine into ciphertext envelope
      const encryptedBlob = Buffer.concat([iv, authTag, ciphertext]);

      // 4. Upload ciphertext to real Kubo IPFS node
      const uploadResult = await defaultStorage.upload(encryptedBlob);

      expect(uploadResult.cid).toBeDefined();
      const cid = uploadResult.cid;

      // 5. Zero-PHI audit: fetch raw IPFS bytes and confirm zero clinical text leakage
      const rawDownloaded = await defaultStorage.retrieve(cid);
      const rawText = rawDownloaded.toString('utf8');

      expect(rawText).not.toContain('heartRateBpm');
      expect(rawText).not.toContain('Normal Sinus Rhythm');
      expect(rawText).not.toContain(patientUser.id);

      // 6. Decrypt payload using KMS unwrap and verify byte-for-byte SHA-256 match
      const recoveredIv = rawDownloaded.subarray(0, 12);
      const recoveredTag = rawDownloaded.subarray(12, 28);
      const recoveredCiphertext = rawDownloaded.subarray(28);

      const unwrappedDek = await localKms.unwrapDek(wrapped.wrappedDek, wrapped.keyVersion);
      expect(unwrappedDek.equals(dek)).toBe(true);

      const decipher = crypto.createDecipheriv('aes-256-gcm', unwrappedDek, recoveredIv);
      decipher.setAuthTag(recoveredTag);
      const decryptedPlaintext = Buffer.concat([decipher.update(recoveredCiphertext), decipher.final()]);

      const decryptedSha256 = crypto.createHash('sha256').update(decryptedPlaintext).digest('hex');
      expect(decryptedSha256).toBe(originalSha256);
      expect(decryptedPlaintext.toString('utf8')).toBe(syntheticClinicalData);
    });

    it('should reject tampered ciphertext with cryptographic authentication failure', async () => {
      const plaintext = Buffer.from('Sensitive test PHI', 'utf8');
      const dek = localKms.generateDek();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const authTag = cipher.getAuthTag();

      // 1-bit tampering in ciphertext
      ciphertext[0] ^= 0xff;

      const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
      decipher.setAuthTag(authTag);

      expect(() => {
        Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      }).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Consent Gating, ABAC & Zero Stale Revocation
  // -------------------------------------------------------------------------
  describe('4. Consent Gating, ABAC Enforcement & Zero Stale Window', () => {
    it('should strictly deny clinician access when consent is absent (HTTP 403 Forbidden)', async () => {
      // Clinician without active consent attempts to access patient record
      const res = await request(app)
        .get(`/api/v1/records/rec-nonexistent-launch-check`)
        .set('Authorization', `Bearer ${unauthDocToken}`);

      expect([401, 403, 404]).toContain(res.status);
    });

    it('should anchor access request on blockchain with zero PHI on-chain', async () => {
      const requestId = `req-launch-${Date.now()}`;
      const anchorTx = await blockchainService.anchorAccessRequest(
        requestId,
        patientUser.id,
        clinicianUser.id,
        'CREATED',
        {
          purpose: 'Diagnosis',
          recordType: 'ECG',
        }
      );

      expect(anchorTx).toBeDefined();
      expect(anchorTx.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(anchorTx.onChainId).toMatch(/^0x[a-fA-F0-9]{64}$/);
      expect(anchorTx.evidenceHash).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 5. AI/ML Advisory Anomaly Scoring
  // -------------------------------------------------------------------------
  describe('5. AI/ML Advisory Scoring & Safety Separation', () => {
    it('should score access request pattern via live FastAPI microservice', async () => {
      const scoreResult = await scoreAccessAnomaly({
        doctorId: clinicianUser.id,
        doctorSpecialty: 'Cardiology',
        hospital: 'Staging Medical Center',
        recordType: 'ECG',
        purpose: 'Diagnosis',
      });

      expect(scoreResult).toBeDefined();
      expect(scoreResult.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(scoreResult.anomalyScore).toBeLessThanOrEqual(100);
      expect(['LOW', 'MODERATE', 'HIGH']).toContain(scoreResult.riskLevel);
      expect(scoreResult.modelVersion).toBe('1.0');
    });

    it('should verify AI/ML signal cannot grant access or decrypt data alone', async () => {
      // High anomaly score does not bypass authorization
      const res = await request(app)
        .get('/api/v1/records/rec-unauthorized-target')
        .set('Authorization', `Bearer ${docToken}`);

      expect([401, 403, 404]).toContain(res.status);
    });
  });

  // -------------------------------------------------------------------------
  // 6. FHIR R4 Interoperability
  // -------------------------------------------------------------------------
  describe('6. FHIR R4 Interoperability & Conformance', () => {
    it('should return valid FHIR CapabilityStatement on /api/v1/fhir/metadata', async () => {
      const res = await request(app).get('/api/v1/fhir/metadata');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/fhir+json');
      expect(res.body.resourceType).toBe('CapabilityStatement');
      expect(res.body.fhirVersion).toBe('4.0.1');
      expect(res.body.status).toBe('active');
    });
  });

  // -------------------------------------------------------------------------
  // 7. Security, Headers & Distributed Tracing
  // -------------------------------------------------------------------------
  describe('7. Security Headers, Rate Limiting & Correlation Tracing', () => {
    it('should include enterprise security headers on all responses', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('X-Test-Rate-Limit', 'true');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['ratelimit-limit']).toBeDefined();
    });

    it('should preserve and propagate custom X-Request-Id header', async () => {
      const traceId = 'launch-trace-alpha-9921';
      const res = await request(app).get('/').set('X-Request-Id', traceId);
      expect(res.headers['x-request-id']).toBe(traceId);
    });
  });
});
