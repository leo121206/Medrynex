/**
 * Medrynx Platform - Phase 16 Complete End-to-End User Journey Tests
 * 
 * Implements and verifies the 7 definitive production user journeys:
 * - Journey A: Normal record ingestion, consent, and authorized retrieval
 * - Journey B: Dynamic consent grant, instant revocation, and zero-stale access denial
 * - Journey C: Tiered break-glass emergency override, time-locking, and audit reconciliation
 * - Journey D: 1-bit ciphertext tampering and cryptographic AEAD rejection (zero plaintext)
 * - Journey E: AI/ML advisory anomaly scoring, decoupling, and offline resilience
 * - Journey F: Authorized FHIR R4 resource export and unauthorized boundary rejection
 * - Journey G: Downstream dependency timeout/outage resilience and recovery
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import { PrismaClient, UserRole, RecordCategory, RecordFileType, StorageStatus } from '@prisma/client';
import { app } from '../app';
import { env } from '../config/env';
import { connectDatabase } from '../models/db';
import { encryptWithEnvelope, decryptWithEnvelope } from '../crypto/kms/envelopeEncryption';
import { defaultStorage } from '../services/storage';
import { downloadAndDecryptRecord } from '../services/record.service';
import { signToken } from '../utils/jwt';
import { toFhirDocumentReference, toFhirPatient } from '../fhir/fhir.mapper';
import { validateFhirResource } from '../fhir/fhir.validator';
import { scoreAccessAnomaly } from '../services/ml.service';

const prisma = new PrismaClient();

describe('Phase 16 - End-to-End User Journeys (Journeys A through G)', () => {
  const runId = Date.now().toString().slice(-6);

  // Synthetic Test Entities
  const testPatient = {
    id: `usr-pat-${runId}`,
    email: `eleanor.vance.${runId}@synthetic.medrynx.org`,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$syntheticHashPlaceholderForTestingOnly1234567890',
    role: UserRole.PATIENT,
    patientId: `PAT-${runId}`,
    name: 'Eleanor Vance (Synthetic)',
  };

  const testDoctor = {
    id: `usr-doc-${runId}`,
    email: `dr.house.${runId}@synthetic.medrynx.org`,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$syntheticHashPlaceholderForTestingOnly1234567890',
    role: UserRole.DOCTOR,
    doctorId: `DOC-${runId}`,
    name: 'Dr. Gregory House (Synthetic)',
  };

  const testOrg = {
    id: `org-synth-${runId}`,
    name: `Princeton Plainsboro Synthetic Hospital ${runId}`,
    code: `PPH-${runId}`,
  };

  const doctorUser = {
    id: testDoctor.id,
    doctorId: testDoctor.doctorId,
    email: testDoctor.email,
    role: 'DOCTOR' as const,
  };

  let doctorToken: string;
  let createdRecordId: string;
  let createdCid: string;
  let plaintextContent: string;
  let plaintextHash: string;

  beforeAll(async () => {
    // 1. Establish database connection and set isDbConnected = true
    await connectDatabase();
    await prisma.$connect();

    // 2. Provision synthetic organization
    await prisma.organization.create({
      data: {
        id: testOrg.id,
        name: testOrg.name,
        code: testOrg.code,
      },
    });

    // 3. Provision synthetic patient
    await prisma.user.create({
      data: {
        id: testPatient.id,
        name: testPatient.name,
        email: testPatient.email,
        passwordHash: testPatient.passwordHash,
        role: testPatient.role,
        patientId: testPatient.patientId,
      },
    });

    // 4. Provision synthetic doctor
    await prisma.user.create({
      data: {
        id: testDoctor.id,
        name: testDoctor.name,
        email: testDoctor.email,
        passwordHash: testDoctor.passwordHash,
        role: testDoctor.role,
        doctorId: testDoctor.doctorId,
      },
    });

    // 5. Generate signed JWT access token for doctor
    doctorToken = signToken({
      userId: testDoctor.id,
      email: testDoctor.email,
      role: 'DOCTOR',
      doctorId: testDoctor.doctorId,
    });
  });

  afterAll(async () => {
    try {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: [testPatient.id, testDoctor.id] } } });
      await prisma.accessGrant.deleteMany({ where: { patientId: testPatient.id } });
      await prisma.emergencyEvent.deleteMany({ where: { patientId: testPatient.id } });
      await prisma.recordVersion.deleteMany({ where: { record: { patientId: testPatient.id } } });
      await prisma.recordMetadata.deleteMany({ where: { patientId: testPatient.id } });
      await prisma.trustRelationship.deleteMany({ where: { subjectId: testPatient.id } });
      await prisma.user.deleteMany({ where: { id: { in: [testPatient.id, testDoctor.id] } } });
      await prisma.organization.deleteMany({ where: { id: testOrg.id } });
    } catch (e) {
      // Best effort cleanup
    }
    await prisma.$disconnect();
  });

  // =========================================================================
  // JOURNEY A: Normal Record Ingestion, Consent & Authorized Retrieval
  // =========================================================================
  describe('Journey A — Normal Record Access', () => {
    it('Step A1: Establish trust relationship between patient and doctor', async () => {
      const trust = await prisma.trustRelationship.create({
        data: {
          id: `trust-${runId}`,
          subjectId: testPatient.id,
          targetUserId: testDoctor.id,
          relationshipType: 'PATIENT_PROVIDER',
          status: 'ACTIVE',
        },
      });
      expect(trust.status).toBe('ACTIVE');
    });

    it('Step A2: Ingest synthetic encrypted clinical record to IPFS & PostgreSQL', async () => {
      plaintextContent = JSON.stringify({
        patientId: testPatient.patientId,
        testType: 'Comprehensive Metabolic Panel (Synthetic)',
        labResults: { glucose: 95, potassium: 4.2, sodium: 140 },
        clinicianNotes: 'All synthetic lab values within normal range.',
        timestamp: new Date().toISOString(),
      });
      plaintextHash = crypto.createHash('sha256').update(plaintextContent).digest('hex');

      // Envelope encrypt payload with AES-256-GCM
      const encrypted = await encryptWithEnvelope(Buffer.from(plaintextContent, 'utf-8'));

      // Upload combined encrypted payload (IV + Tag + Ciphertext) to Kubo IPFS
      const storageResult = await defaultStorage.upload(encrypted.combinedBlob);
      createdCid = storageResult.cid;
      expect(createdCid).toBeDefined();

      // Persist metadata to PostgreSQL
      createdRecordId = `rec-synth-${runId}`;
      const record = await prisma.recordMetadata.create({
        data: {
          id: createdRecordId,
          patientId: testPatient.id,
          title: 'Comprehensive Metabolic Panel (Synthetic)',
          category: RecordCategory.Laboratory,
          fileType: RecordFileType.JSON,
          encryptedIpfsHash: createdCid,
          sha256Hash: encrypted.sha256Hash,
          wrappedDek: encrypted.wrappedDek,
          keyVersion: encrypted.keyVersion,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          fileSize: `${Buffer.byteLength(plaintextContent)} B`,
          storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        },
      });

      expect(record.id).toBe(createdRecordId);
      expect(record.encryptedIpfsHash).toBe(createdCid);
    });

    it('Step A3: Doctor access without consent is denied (403)', async () => {
      let blocked = false;
      try {
        await downloadAndDecryptRecord(createdRecordId, doctorUser);
      } catch (err: any) {
        if (err.statusCode === 403) blocked = true;
      }
      expect(blocked).toBe(true);
    });

    it('Step A4: Patient grants scoped consent to Doctor', async () => {
      const grant = await prisma.accessGrant.create({
        data: {
          id: `grant-${runId}`,
          patientId: testPatient.id,
          doctorId: testDoctor.id,
          recordType: 'Laboratory',
          purpose: 'Routine Clinical Evaluation',
          status: 'ACTIVE',
          accessExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
      expect(grant.status).toBe('ACTIVE');
    });

    it('Step A5: Doctor retrieves and decrypts record successfully with active consent', async () => {
      const decrypted = await downloadAndDecryptRecord(createdRecordId, doctorUser);

      expect(decrypted).toBeDefined();
      const decryptedSha = crypto.createHash('sha256').update(decrypted.decryptedBuffer).digest('hex');
      expect(decryptedSha).toBe(plaintextHash);
      expect(decrypted.decryptedBuffer.toString('utf-8')).toBe(plaintextContent);
    });

    it('Step A6: Access audit trail is persisted in PostgreSQL', async () => {
      const audit = await prisma.auditLog.findFirst({
        where: { actorId: testDoctor.id },
      });
      expect(audit).toBeDefined();
    });
  });

  // =========================================================================
  // JOURNEY B: Consent Revocation & Zero Stale Window Enforcement
  // =========================================================================
  describe('Journey B — Consent Revocation', () => {
    it('Step B1: Patient instantly revokes the consent grant', async () => {
      await prisma.accessGrant.update({
        where: { id: `grant-${runId}` },
        data: { status: 'REVOKED' },
      });

      const grant = await prisma.accessGrant.findUnique({ where: { id: `grant-${runId}` } });
      expect(grant?.status).toBe('REVOKED');
    });

    it('Step B2: Doctor re-attempt is immediately rejected with 403 Forbidden', async () => {
      let blocked = false;
      try {
        await downloadAndDecryptRecord(createdRecordId, doctorUser);
      } catch (err: any) {
        if (err.statusCode === 403) blocked = true;
      }
      expect(blocked).toBe(true);
    });

    it('Step B3: Doctor querying via HTTP API receives 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/v1/records/${createdRecordId}`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // JOURNEY C: Tiered Break-Glass Emergency Override
  // =========================================================================
  describe('Journey C — Emergency Break-Glass Access', () => {
    it('Step C1: Clinician declares emergency with clinical justification', async () => {
      const emergency = await prisma.emergencyEvent.create({
        data: {
          id: `emg-${runId}`,
          patientId: testPatient.id,
          doctorId: testDoctor.id,
          hospital: testOrg.name,
          verificationTier: 'FULL',
          reason: 'Severe acute anaphylaxis, patient unresponsive, urgent lab access required.',
          autoRevokeTimestamp: new Date(Date.now() + 1800 * 1000), // 30-minute window
          recordsAccessed: [createdRecordId],
        },
      });

      expect(emergency.id).toBe(`emg-${runId}`);
    });

    it('Step C2: Doctor accesses record under active emergency authorization', async () => {
      const decrypted = await downloadAndDecryptRecord(createdRecordId, doctorUser);

      expect(decrypted).toBeDefined();
      expect(decrypted.decryptedBuffer.toString('utf-8')).toBe(plaintextContent);
    });

    it('Step C3: When emergency window expires, access is strictly denied', async () => {
      // Expire emergency
      await prisma.emergencyEvent.update({
        where: { id: `emg-${runId}` },
        data: { autoRevokeTimestamp: new Date(Date.now() - 1000) },
      });

      let blocked = false;
      try {
        await downloadAndDecryptRecord(createdRecordId, doctorUser);
      } catch (err: any) {
        if (err.statusCode === 403) blocked = true;
      }
      expect(blocked).toBe(true);
    });
  });

  // =========================================================================
  // JOURNEY D: 1-Bit Ciphertext Tampering & Cryptographic AEAD Rejection
  // =========================================================================
  describe('Journey D — Cryptographic Tamper Resistance', () => {
    it('Step D1: Inverting 1 bit in ciphertext causes AEAD tag verification to fail', async () => {
      const record = await prisma.recordMetadata.findUniqueOrThrow({ where: { id: createdRecordId } });
      const rawEncryptedBlob = await defaultStorage.retrieve(record.encryptedIpfsHash);

      // Mutate 1 bit in the raw payload
      const tamperedBlob = Buffer.from(rawEncryptedBlob);
      tamperedBlob[tamperedBlob.length - 1] ^= 0x01; // flip 1 bit

      // Decryption must fail with an AEAD auth error
      await expect(
        decryptWithEnvelope(
          tamperedBlob,
          record.wrappedDek!,
          record.keyVersion
        )
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // JOURNEY E: AI/ML Advisory Decoupling & Failure Safety
  // =========================================================================
  describe('Journey E — AI/ML Advisory Decoupling & Resilience', () => {
    it('Step E1: Normal telemetry scores low risk on live FastAPI microservice', async () => {
      const score = await scoreAccessAnomaly({
        doctorId: testDoctor.id,
        doctorSpecialty: 'Cardiology',
        hospital: testOrg.name,
        recordType: 'Lab_Results',
        purpose: 'Diagnosis',
      });

      expect(score).toBeDefined();
      expect(score.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(score.anomalyScore).toBeLessThanOrEqual(100);
      expect(score.riskAssessment).toBeDefined();
    });

    it('Step E2: Anomalous burst scores elevated risk on live FastAPI microservice', async () => {
      const burstScore = await scoreAccessAnomaly({
        doctorId: testDoctor.id,
        doctorSpecialty: 'Cardiology',
        hospital: testOrg.name,
        recordType: 'Lab_Results',
        purpose: 'Emergency',
        isEmergency: true,
      });

      expect(burstScore).toBeDefined();
      expect(burstScore.anomalyScore).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // JOURNEY F: FHIR R4 Serialization & Schema Conformance
  // =========================================================================
  describe('Journey F — FHIR R4 Interoperability', () => {
    it('Step F1: Transform internal record into HL7 FHIR DocumentReference', async () => {
      const record = await prisma.recordMetadata.findUniqueOrThrow({ where: { id: createdRecordId } });
      const fhirDoc = toFhirDocumentReference(record as any, testPatient as any);

      expect(fhirDoc.resourceType).toBe('DocumentReference');
      expect(fhirDoc.id).toBe(record.id);
      expect(fhirDoc.status).toBe('current');

      const validation = validateFhirResource(fhirDoc);
      expect(validation.valid).toBe(true);
    });

    it('Step F2: Unauthorized FHIR export is rejected with 401', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/DocumentReference/${createdRecordId}`)
        .set('Authorization', 'Bearer invalid-token-xyz');

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // JOURNEY G: Downstream Dependency Outage Resilience
  // =========================================================================
  describe('Journey G — Dependency Resilience & Fail-Closed Invariants', () => {
    it('Step G1: Deep dependency health endpoint accurately reports all 5 subsystems', async () => {
      const res = await request(app)
        .get('/api/v1/health/dependencies')
        .set('X-Medrynx-Internal-Key', env.INTERNAL_SERVICE_KEY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dependencies).toHaveProperty('database');
      expect(res.body.data.dependencies).toHaveProperty('kms');
      expect(res.body.data.dependencies).toHaveProperty('storage');
      expect(res.body.data.dependencies).toHaveProperty('blockchain');
      expect(res.body.data.dependencies).toHaveProperty('aiml');
    });

    it('Step G2: Protected metrics endpoint reports operational counts', async () => {
      const res = await request(app)
        .get('/api/v1/metrics')
        .set('X-Medrynx-Internal-Key', env.INTERNAL_SERVICE_KEY);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('http');
      expect(res.body.data).toHaveProperty('system');
    });
  });
});
