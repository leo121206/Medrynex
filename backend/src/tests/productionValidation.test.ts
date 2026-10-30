import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../app';
import { LocalKeyManagementService } from '../crypto/kms/LocalKeyManagementService';
import { encryptWithEnvelope, decryptWithEnvelope } from '../crypto/kms/envelopeEncryption';
import { LocalStorageAdapter } from '../services/storage/LocalStorageAdapter';
import { defaultStorage } from '../services/storage';
import { signToken } from '../utils/jwt';
import { store } from '../models/store';
import { RecordCategory, RecordFileType, StorageStatus, UserRole } from '@prisma/client';

// Mock DB to enable deterministic in-memory store assertions
vi.mock('../models/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    recordMetadata: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    accessGrant: { findFirst: vi.fn() },
    emergencyEvent: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
  },
  connectDatabase: vi.fn(),
  isDbConnected: false, // Route through in-memory store for exact deterministic state tests
}));

describe('Production Validation & Security Hardening Test Suite', () => {
  const masterKms = new LocalKeyManagementService('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  const storageAdapter = new LocalStorageAdapter();

  // Test entities
  const patientA = {
    id: 'usr-patient-001',
    email: 'patientA@medrynx.org',
    role: 'PATIENT' as const,
    patientId: 'PT-98234',
    organizationId: 'org-hosp-001',
  };

  const patientB = {
    id: 'usr-patient-002',
    email: 'patientB@medrynx.org',
    role: 'PATIENT' as const,
    patientId: 'PT-11111',
    organizationId: 'org-hosp-001',
  };

  const doctorA = {
    id: 'usr-doctor-001',
    email: 'doctorA@medrynx.org',
    role: 'DOCTOR' as const,
    doctorId: 'd-201',
    hospital: 'ABC Hospital',
    organizationId: 'org-hosp-001',
  };

  const doctorB = {
    id: 'usr-doctor-hospB',
    email: 'doctorB@stjude.org',
    role: 'DOCTOR' as const,
    doctorId: 'd-999',
    hospital: 'St. Jude Heart Institute',
    organizationId: 'org-hosp-002',
  };

  const platformAdmin = {
    id: 'usr-plat-admin',
    email: 'platform.admin@medrynx.org',
    role: 'PLATFORM_ADMIN' as const,
    adminId: 'adm-001',
  };

  const tokenPatientA = signToken(patientA);
  const tokenPatientB = signToken(patientB);
  const tokenDoctorA = signToken(doctorA);
  const tokenDoctorB = signToken(doctorB);
  const tokenAdmin = signToken(platformAdmin);

  beforeEach(() => {
    // Reset test grants and records state
    store.grants = [];
    store.records = [];
    store.emergencies = [];
  });

  // =========================================================================
  // 1. END-TO-END FLOW & PLAINTEXT SECURITY (Requirements 1 & 2)
  // =========================================================================
  describe('1 & 2. End-to-End Pipeline & Plaintext Security', () => {
    it('should complete UPLOAD -> ENCRYPT -> STORE -> RETRIEVE -> DECRYPT with 100% byte-for-byte fidelity', async () => {
      const originalPlaintext = 'CONFIDENTIAL CLINICAL REPORT: Patient shows normal cardiac rhythm. Troponin T < 0.01 ng/mL.';
      const originalBuffer = Buffer.from(originalPlaintext, 'utf-8');

      // 1. Envelope Encrypt
      const encResult = await encryptWithEnvelope(originalBuffer, masterKms);
      expect(encResult.wrappedDek).toBeDefined();
      expect(encResult.sha256Hash).toBeDefined();

      // 2. CRITICAL SECURITY CHECK: Raw encrypted blob MUST NOT contain the plaintext string
      expect(encResult.combinedBlob.includes(originalBuffer)).toBe(false);
      expect(encResult.combinedBlob.toString('utf-8')).not.toContain('CONFIDENTIAL CLINICAL REPORT');

      // 3. Push to storage (IPFS / content-addressed storage adapter)
      const storageResult = await storageAdapter.upload(encResult.combinedBlob, 'clinical_report.pdf');
      expect(storageResult.cid).toBeDefined();
      expect(storageResult.sizeBytes).toBe(encResult.combinedBlob.length);

      // 4. Retrieve raw stored blob by CID
      const fetchedRawBlob = await storageAdapter.retrieve(storageResult.cid);
      expect(fetchedRawBlob.equals(encResult.combinedBlob)).toBe(true);

      // 5. Verify integrity digest against stored on-chain anchor hash
      const computedHash = crypto.createHash('sha256').update(fetchedRawBlob).digest('hex');
      expect(computedHash).toBe(encResult.sha256Hash);

      // 6. Decrypt using wrapped DEK and KMS
      const decryptedBuffer = await decryptWithEnvelope(fetchedRawBlob, encResult.wrappedDek, encResult.keyVersion, masterKms);

      // 7. Verify byte-for-byte fidelity
      expect(decryptedBuffer.equals(originalBuffer)).toBe(true);
      expect(decryptedBuffer.toString('utf-8')).toBe(originalPlaintext);
    });

    it('SECURITY TEST: Raw storage payload MUST FAIL if plaintext is accidentally stored', async () => {
      const secretPayload = 'TOP-SECRET-PHI-DIAGNOSIS-CANCER-NEGATIVE';

      // Simulation of a faulty upload where plaintext is saved directly
      const plaintextBuffer = Buffer.from(secretPayload, 'utf-8');
      const faultyStorageResult = await storageAdapter.upload(plaintextBuffer);

      // Verify that inspecting raw bytes detects the leakage
      const rawFetched = await storageAdapter.retrieve(faultyStorageResult.cid);
      const isLeaking = rawFetched.includes(Buffer.from('TOP-SECRET-PHI', 'utf-8'));
      expect(isLeaking).toBe(true); // Demonstrates our test detector works!

      // Now verify that real envelope encryption PREVENTS leakage
      const safeEncryption = await encryptWithEnvelope(plaintextBuffer, masterKms);
      const safeStorageResult = await storageAdapter.upload(safeEncryption.combinedBlob);
      const safeRaw = await storageAdapter.retrieve(safeStorageResult.cid);
      expect(safeRaw.includes(Buffer.from('TOP-SECRET-PHI', 'utf-8'))).toBe(false);
    });
  });

  // =========================================================================
  // 3. ENCRYPTION HARDENING & TAMPER RESISTANCE (Requirement 3)
  // =========================================================================
  describe('3. Encryption Hardening & Tamper Resistance', () => {
    it('should reject decryption when ciphertext is tampered (1-bit flip in ciphertext)', async () => {
      const sensitiveData = Buffer.from('Patient Genetic Screening: Negative for BRCA1/BRCA2 mutations.', 'utf-8');
      const encResult = await encryptWithEnvelope(sensitiveData, masterKms);

      const tamperedBlob = Buffer.from(encResult.combinedBlob);
      // Flip a bit in the ciphertext payload (after 28 bytes of IV + Tag)
      tamperedBlob[30] ^= 0x01;

      await expect(
        decryptWithEnvelope(tamperedBlob, encResult.wrappedDek, encResult.keyVersion, masterKms)
      ).rejects.toThrow();
    });

    it('should reject decryption when authentication tag is tampered', async () => {
      const sensitiveData = Buffer.from('Surgical Operative Report: Laparoscopic Appendectomy Successful.', 'utf-8');
      const encResult = await encryptWithEnvelope(sensitiveData, masterKms);

      const tamperedBlob = Buffer.from(encResult.combinedBlob);
      // Flip a bit in the GMAC authentication tag (bytes 12-27)
      tamperedBlob[15] ^= 0x01;

      await expect(
        decryptWithEnvelope(tamperedBlob, encResult.wrappedDek, encResult.keyVersion, masterKms)
      ).rejects.toThrow();
    });

    it('should reject decryption when wrong KEK key is used for DEK unwrapping', async () => {
      const wrongKms = new LocalKeyManagementService('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const data = Buffer.from('Pediatric Immunization Record: MMR Dose 2 Administered.', 'utf-8');
      const encResult = await encryptWithEnvelope(data, masterKms);

      await expect(
        decryptWithEnvelope(encResult.combinedBlob, encResult.wrappedDek, encResult.keyVersion, wrongKms)
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 4 & 5. SERVER-SIDE ACCESS CONTROL & CID BYPASS PREVENTION (Requirements 4 & 5)
  // =========================================================================
  describe('4 & 5. Access Control Matrix & CID Bypass Prevention', () => {
    let testRecordId: string;
    let testCid: string;

    beforeEach(async () => {
      // Seed a record owned by Patient A
      const rawContent = Buffer.from('Echocardiogram Report: LVEF 62%, Normal valves.', 'utf-8');
      const enc = await encryptWithEnvelope(rawContent, masterKms);
      const storeRes = await defaultStorage.upload(enc.combinedBlob);
      testCid = storeRes.cid;
      testRecordId = `rec-echocardiogram-${Date.now()}`;

      store.records.push({
        id: testRecordId,
        patientId: patientA.id,
        organizationId: 'org-hosp-001',
        title: 'Echocardiogram',
        category: RecordCategory.Cardiology,
        description: 'Routine echo',
        fileType: RecordFileType.PDF,
        fileSize: '1.2 MB',
        encryptedIpfsHash: testCid,
        sha256Hash: enc.sha256Hash,
        isEncrypted: true,
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        recordDate: new Date(),
        wrappedDek: enc.wrappedDek,
        keyVersion: enc.keyVersion,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('Scenario 1: Patient A -> Patient A record -> ALLOW (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/records/${testRecordId}/download`)
        .set('Authorization', `Bearer ${tokenPatientA}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('Scenario 2: Patient B -> Patient A record -> DENY (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/records/${testRecordId}/download`)
        .set('Authorization', `Bearer ${tokenPatientB}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Scenario 3: Doctor A without consent -> DENY (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/records/${testRecordId}/download`)
        .set('Authorization', `Bearer ${tokenDoctorA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('Scenario 4: Doctor A with active Cardiology consent -> ALLOW (200)', async () => {
      // Grant consent
      store.grants.push({
        id: 'grant-cardio-001',
        patientId: patientA.id,
        doctorId: doctorA.id,
        recordType: 'Cardiology',
        status: 'ACTIVE',
        grantedAt: new Date(),
        accessExpiry: new Date(Date.now() + 86400000), // +24 hours
        txHash: '0x1234567890abcdef',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/v1/records/${testRecordId}/download`)
        .set('Authorization', `Bearer ${tokenDoctorA}`);

      expect(res.status).toBe(200);
    });

    it('Scenario 5: Doctor A with revoked consent -> DENY (403)', async () => {
      store.grants.push({
        id: 'grant-cardio-revoked',
        patientId: patientA.id,
        doctorId: doctorA.id,
        recordType: 'Cardiology',
        status: 'REVOKED', // Explicitly revoked by patient
        grantedAt: new Date(),
        accessExpiry: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/v1/records/${testRecordId}/download`)
        .set('Authorization', `Bearer ${tokenDoctorA}`);

      expect(res.status).toBe(403);
    });

    it('Scenario 6: Doctor A with expired consent -> DENY (403)', async () => {
      store.grants.push({
        id: 'grant-cardio-expired',
        patientId: patientA.id,
        doctorId: doctorA.id,
        recordType: 'Cardiology',
        status: 'ACTIVE',
        grantedAt: new Date(Date.now() - 86400000 * 2),
        accessExpiry: new Date(Date.now() - 3600000), // Expired 1 hour ago
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get(`/api/v1/records/${testRecordId}/download`)
        .set('Authorization', `Bearer ${tokenDoctorA}`);

      expect(res.status).toBe(403);
    });

    it('Scenario 7: Platform Admin attempting to download clinical data -> DENY (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/records/${testRecordId}/download`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Platform admins cannot decrypt');
    });

    it('Scenario 8: CID Bypass Attempt (unauthenticated direct access) -> DENY (401)', async () => {
      // Direct access without Bearer token must fail
      const res = await request(app)
        .get(`/api/v1/records/${testRecordId}/download`);

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 11. EMERGENCY ACCESS BREAK-GLASS & TIME-LOCK EXPIRY (Requirement 11)
  // =========================================================================
  describe('11. Emergency Break-Glass & Time-Lock Expiry', () => {
    it('should allow access during active emergency window and deny after time-lock expires', async () => {
      const emergencyRecordId = `rec-emerg-${Date.now()}`;
      const rawPayload = Buffer.from('Emergency Trauma Blood Type: O Negative. Severe Penicillin Allergy.', 'utf-8');
      const enc = await encryptWithEnvelope(rawPayload, masterKms);
      const uploadRes = await defaultStorage.upload(enc.combinedBlob);

      store.records.push({
        id: emergencyRecordId,
        patientId: patientA.id,
        organizationId: 'org-hosp-001',
        title: 'Emergency Summary',
        category: RecordCategory.EmergencySummary,
        description: 'Triage Summary',
        fileType: RecordFileType.PDF,
        fileSize: '200 KB',
        encryptedIpfsHash: uploadRes.cid,
        sha256Hash: enc.sha256Hash,
        isEncrypted: true,
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        recordDate: new Date(),
        wrappedDek: enc.wrappedDek,
        keyVersion: enc.keyVersion,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 1. Doctor triggers active emergency session (valid for 15 minutes)
      store.emergencies.push({
        id: 'emerg-session-001',
        doctorId: doctorA.id,
        patientId: patientA.id,
        hospital: 'ABC Hospital',
        reason: 'Acute cardiac arrest in ER',
        code: 'CODE-BLUE-01',
        tier: 'TIER_1',
        status: 'ACTIVE',
        disputed: false,
        triggeredAt: new Date(),
        autoRevokeTimestamp: new Date(Date.now() + 15 * 60 * 1000), // +15 mins
        createdAt: new Date(),
      });

      // 2. Access during emergency window -> ALLOW (200)
      const activeRes = await request(app)
        .get(`/api/v1/records/${emergencyRecordId}/download`)
        .set('Authorization', `Bearer ${tokenDoctorA}`);

      expect(activeRes.status).toBe(200);

      // 3. Fast-forward time: Emergency expires
      store.emergencies[0].autoRevokeTimestamp = new Date(Date.now() - 1000); // 1 sec ago

      // 4. Access after expiry -> DENY (403)
      const expiredRes = await request(app)
        .get(`/api/v1/records/${emergencyRecordId}/download`)
        .set('Authorization', `Bearer ${tokenDoctorA}`);

      expect(expiredRes.status).toBe(403);
    });
  });

  // =========================================================================
  // 18. PERFORMANCE BENCHMARKS: SMALL, MEDIUM & LARGE RECORDS (Requirement 18)
  // =========================================================================
  describe('18. Performance Benchmarking across Payload Sizes', () => {
    it('should measure encryption, storage, and decryption timings for small, medium, and large documents', async () => {
      const sizes = [
        { label: 'Small (10 KB)', bytes: 10 * 1024 },
        { label: 'Medium (500 KB)', bytes: 500 * 1024 },
        { label: 'Large (2 MB)', bytes: 2 * 1024 * 1024 },
      ];

      for (const item of sizes) {
        const payload = crypto.randomBytes(item.bytes);

        // 1. Measure Encryption
        const startEnc = performance.now();
        const encResult = await encryptWithEnvelope(payload, masterKms);
        const encDurationMs = performance.now() - startEnc;

        // 2. Measure Storage
        const startStore = performance.now();
        const storeResult = await storageAdapter.upload(encResult.combinedBlob);
        const storeDurationMs = performance.now() - startStore;

        // 3. Measure Retrieval
        const startFetch = performance.now();
        const fetchedBlob = await storageAdapter.retrieve(storeResult.cid);
        const fetchDurationMs = performance.now() - startFetch;

        // 4. Measure Decryption
        const startDec = performance.now();
        const decResult = await decryptWithEnvelope(fetchedBlob, encResult.wrappedDek, encResult.keyVersion, masterKms);
        const decDurationMs = performance.now() - startDec;

        // Invariant: Data must match exactly
        expect(decResult.equals(payload)).toBe(true);

        // Performance Assertions (must complete within realistic sub-second thresholds)
        expect(encDurationMs).toBeLessThan(1000);
        expect(decDurationMs).toBeLessThan(1000);
      }
    });
  });
});
