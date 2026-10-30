import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma, isDbConnected, connectDatabase } from '../models/db';
import { localKms } from '../crypto/kms/LocalKeyManagementService';
import { defaultStorage } from '../services/storage';
import { blockchainService } from '../services/blockchain.service';
import { getModelHealth, scoreAccessAnomaly } from '../services/ml.service';
import { signToken } from '../utils/jwt';
import { validateProductionConfig } from '../config/env';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';

describe('MEDRYNX PHASE 14 — PRODUCTION INFRASTRUCTURE & CONTROLLED DEPLOYMENT SUITE', () => {
  const adminUser = {
    id: 'infra-admin-01',
    email: 'admin.infra@medrynx.org',
    role: UserRole.ADMIN,
  };

  const doctorUser = {
    id: 'infra-doc-01',
    email: 'dr.curie@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-INFRA-1',
    hospital: 'Metropolitan General',
  };

  const patientUser = {
    id: 'infra-pat-01',
    email: 'patient.marie@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-INFRA-1',
  };

  const patientB = {
    id: 'infra-pat-02',
    email: 'patient.bob@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-INFRA-2',
  };

  const adminToken = signToken(adminUser);
  const doctorToken = signToken(doctorUser);
  const patientToken = signToken(patientUser);
  const patientBToken = signToken(patientB);

  beforeAll(async () => {
    await connectDatabase();
  });

  // -------------------------------------------------------------------------
  // 1. Production Configuration & Secret Validation
  // -------------------------------------------------------------------------
  describe('1. Production Configuration & Secret Validation', () => {
    it('should pass validation when production config meets enterprise security criteria', () => {
      const validProdConfig: any = {
        NODE_ENV: 'production',
        PORT: 5000,
        DATABASE_URL: 'postgresql://medrynx_admin:strong_pw@db:5432/medrynx_prod?sslmode=require',
        JWT_SECRET: 'a_very_long_secure_jwt_production_secret_key_32_chars_min',
        JWT_EXPIRES_IN: '15m',
        AES_SECRET_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        IPFS_API_URL: 'http://ipfs:5001',
        IPFS_GATEWAY_URL: 'http://ipfs:8080/ipfs/',
        IPFS_MOCK_ENABLED: false,
        GANACHE_RPC_URL: 'http://polygon-rpc.internal:8545',
        DEPLOYER_PRIVATE_KEY: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        INTERNAL_SERVICE_KEY: 'production-internal-service-secret-key-99',
        CORS_ORIGIN: 'https://medrynx.org,https://app.medrynx.org',
        ANOMALY_THRESHOLD: 65,
        RATE_LIMIT_WINDOW_MS: 60000,
        RATE_LIMIT_MAX_REQUESTS: 300,
        AUTH_RATE_LIMIT_MAX: 20,
        REQUEST_TIMEOUT_MS: 15000,
      };

      const result = validateProductionConfig(validProdConfig);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject production config when default dev JWT secret or short keys are used', () => {
      const invalidConfig: any = {
        NODE_ENV: 'production',
        JWT_SECRET: 'medrynx_super_secret_jwt_key_2026_change_in_production',
        AES_SECRET_KEY: 'short_key',
        IPFS_MOCK_ENABLED: true,
        CORS_ORIGIN: '*',
        INTERNAL_SERVICE_KEY: 'medrynx-internal-dev-service-key-2026',
      };

      const result = validateProductionConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
      expect(result.errors.some((e) => e.includes('AES_SECRET_KEY'))).toBe(true);
      expect(result.errors.some((e) => e.includes('IPFS_MOCK_ENABLED'))).toBe(true);
      expect(result.errors.some((e) => e.includes('CORS_ORIGIN'))).toBe(true);
      expect(result.errors.some((e) => e.includes('INTERNAL_SERVICE_KEY'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Database Topology & Referential Integrity
  // -------------------------------------------------------------------------
  describe('2. Database Topology & Schema Verification', () => {
    it('should verify live PostgreSQL connection and core 14 tables exist', async () => {
      expect(isDbConnected).toBe(true);

      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
      `;
      const names = tables.map((t) => t.tablename);

      expect(names).toContain('users');
      expect(names).toContain('records_metadata');
      expect(names).toContain('record_versions');
      expect(names).toContain('access_grants');
      expect(names).toContain('consent_batches');
      expect(names).toContain('emergency_events');
      expect(names).toContain('audit_log');
      expect(names).toContain('trust_relationships');
      expect(names).toContain('refresh_tokens');
      expect(names).toContain('organizations');
    });
  });

  // -------------------------------------------------------------------------
  // 3. KMS Key Lifecycle & Envelope Encryption
  // -------------------------------------------------------------------------
  describe('3. KMS Key Lifecycle & Envelope Encryption', () => {
    it('should generate DEK, wrap under KEK, and verify byte-for-byte decryption fidelity', async () => {
      const dek = localKms.generateDek();
      expect(dek.length).toBe(32);

      const wrapped = await localKms.wrapDek(dek);
      expect(wrapped.wrappedDek).toBeDefined();
      expect(wrapped.keyVersion).toBeGreaterThanOrEqual(1);

      const unwrapped = await localKms.unwrapDek(wrapped.wrappedDek, wrapped.keyVersion);
      expect(unwrapped.equals(dek)).toBe(true);
    });

    it('should support Master KEK rotation and DEK re-wrapping without plaintext exposure', async () => {
      const originalVersion = localKms.getActiveVersion();
      const dek = localKms.generateDek();
      const wrappedOld = await localKms.wrapDek(dek, originalVersion);

      // Rotate Master KEK to next version
      const newVersion = await localKms.rotateKek();
      expect(newVersion).toBe(originalVersion + 1);

      // Re-wrap DEK to new version
      const rewrapped = await localKms.rewrapDek(wrappedOld.wrappedDek, originalVersion, newVersion);
      expect(rewrapped.keyVersion).toBe(newVersion);

      // Decrypt using new version
      const unwrappedNew = await localKms.unwrapDek(rewrapped.wrappedDek, newVersion);
      expect(unwrappedNew.equals(dek)).toBe(true);
    });

    it('should detect and reject corrupted or tampered wrapped DEK payloads', async () => {
      const dek = localKms.generateDek();
      const wrapped = await localKms.wrapDek(dek);

      // Tamper base64 payload
      const tamperedBytes = Buffer.from(wrapped.wrappedDek, 'base64');
      tamperedBytes[tamperedBytes.length - 1] ^= 0xff;
      const tamperedBase64 = tamperedBytes.toString('base64');

      await expect(localKms.unwrapDek(tamperedBase64, wrapped.keyVersion)).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 4. IPFS Content-Addressed Storage & Zero-PHI Audit
  // -------------------------------------------------------------------------
  describe('4. IPFS Content-Addressed Storage & Zero-PHI Audit', () => {
    it('should pin encrypted envelope to Kubo IPFS and verify zero plaintext in raw bytes', async () => {
      const syntheticReport = JSON.stringify({
        patientId: patientUser.id,
        testType: 'CARDIAC_ENZYME_PANEL',
        troponinI: '0.01 ng/mL',
        status: 'NORMAL',
        confidentialNote: 'Synthetic deployment verification test',
      });

      const dek = localKms.generateDek();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
      const ciphertext = Buffer.concat([cipher.update(Buffer.from(syntheticReport, 'utf8')), cipher.final()]);
      const tag = cipher.getAuthTag();

      // Combined ciphertext blob
      const blob = Buffer.concat([iv, tag, ciphertext]);

      // Upload to live IPFS
      const upload = await defaultStorage.upload(blob);
      expect(upload.cid).toBeDefined();

      // Retrieve raw bytes directly from IPFS
      const retrieved = await defaultStorage.retrieve(upload.cid);
      expect(retrieved.equals(blob)).toBe(true);

      // Scan raw retrieved bytes for plaintext leakage
      const rawText = retrieved.toString('utf8');
      expect(rawText).not.toContain('troponinI');
      expect(rawText).not.toContain('CARDIAC_ENZYME_PANEL');
      expect(rawText).not.toContain(patientUser.id);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Blockchain Network, Chain ID & Contract Bytecode Verification
  // -------------------------------------------------------------------------
  describe('5. Blockchain Network, Chain ID & Contract Bytecode Verification', () => {
    it('should verify live provider connection, chain ID, and non-empty contract bytecode', async () => {
      const verification = await blockchainService.verifyNetworkAndBytecode();
      expect(verification.connected).toBe(true);
      expect(verification.chainId).toBe(31337);
      expect(verification.contractsVerified).toBe(true);
      expect(verification.details.MedrynxAuditLogger.hasBytecode).toBe(true);
      expect(verification.details.MedrynxAccessRegistry.hasBytecode).toBe(true);
      expect(verification.details.MedrynxEmergencyVault.hasBytecode).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. AI/ML Microservice Advisory Decoupling
  // -------------------------------------------------------------------------
  describe('6. AI/ML Microservice Advisory Decoupling', () => {
    it('should evaluate access risk without bypassing ABAC access control', async () => {
      const health = await getModelHealth();
      expect(health.status).toBe('ok');
      expect(health.modelLoaded).toBe(true);

      const score = await scoreAccessAnomaly({
        doctorId: doctorUser.id,
        doctorSpecialty: 'Cardiology',
        hospital: doctorUser.hospital,
        recordType: 'CARDIAC_REPORT',
        purpose: 'Diagnosis',
      });

      expect(score.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(score.anomalyScore).toBeLessThanOrEqual(100);
      expect(['LOW', 'MODERATE', 'HIGH']).toContain(score.riskLevel);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Security Headers, Rate Limiting & Correlation Tracing
  // -------------------------------------------------------------------------
  describe('7. Security Headers, Rate Limiting & Correlation Tracing', () => {
    it('should include enterprise security headers and reflect X-Request-Id', async () => {
      const customId = 'infra-trace-99120';
      const res = await request(app)
        .get('/api/v1/health')
        .set('X-Request-Id', customId)
        .set('X-Test-Rate-Limit', 'true');

      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-request-id']).toBe(customId);
      expect(res.headers['ratelimit-limit']).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Cluster Readiness & Dependency Telemetry
  // -------------------------------------------------------------------------
  describe('8. Cluster Readiness & Dependency Telemetry', () => {
    it('should report READY status with all dependencies healthy on /health/readiness', async () => {
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
});
