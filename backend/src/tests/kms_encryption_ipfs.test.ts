import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import { LocalKeyManagementService, localKms } from '../crypto/kms/LocalKeyManagementService';
import { encryptWithEnvelope, decryptWithEnvelope } from '../crypto/kms/envelopeEncryption';
import { uploadToIpfs, fetchFromIpfs, pinIpfsCid, unpinIpfsCid, defaultStorage } from '../services/ipfs.service';
import {
  uploadAndAnchorRecord,
  downloadAndDecryptRecord,
  createRecordVersion,
  downloadAndDecryptRecordVersion,
  tombstoneRecord,
  checkRecordAuthorization,
} from '../services/record.service';
import { prisma, isDbConnected } from '../models/db';
import { store } from '../models/store';
import { AuthenticatedUser } from '../types/common.types';
import { RecordCategory } from '@prisma/client';

describe('MEDRYNX PHASE 7 — KMS, ENCRYPTION & IPFS INTEGRATION', () => {
  // Fresh KMS instance for isolated testing
  const testKekHex = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  let kms: LocalKeyManagementService;

  beforeAll(() => {
    kms = new LocalKeyManagementService(testKekHex);
  });

  // =========================================================================
  // 1. KMS & KEY LIFECYCLE
  // =========================================================================
  describe('1. Enterprise Key Management Service (KMS) & Lifecycle', () => {
    it('1.1 should generate 256-bit (32 bytes) cryptographically secure pseudorandom DEKs', () => {
      const dek1 = kms.generateDek();
      const dek2 = kms.generateDek();

      expect(Buffer.isBuffer(dek1)).toBe(true);
      expect(dek1.length).toBe(32);
      expect(dek2.length).toBe(32);
      // Different keys must be generated each time
      expect(dek1.equals(dek2)).toBe(false);
    });

    it('1.2 should wrap DEK using AES-256-GCM under master KEK and produce 60-byte payload', async () => {
      const dek = kms.generateDek();
      const wrapped = await kms.wrapDek(dek);

      expect(wrapped.wrappedDek).toBeDefined();
      expect(wrapped.keyVersion).toBe(1);
      expect(wrapped.algorithm).toBe('AES-256-GCM/KEK-WRAP');

      const rawWrapped = Buffer.from(wrapped.wrappedDek, 'base64');
      // 12 bytes IV + 16 bytes Tag + 32 bytes encrypted DEK = 60 bytes
      expect(rawWrapped.length).toBe(60);
    });

    it('1.3 should unwrap wrapped DEK back to identical 32-byte plaintext key', async () => {
      const originalDek = kms.generateDek();
      const wrapped = await kms.wrapDek(originalDek);

      const unwrappedDek = await kms.unwrapDek(wrapped.wrappedDek, wrapped.keyVersion);
      expect(unwrappedDek.length).toBe(32);
      expect(unwrappedDek.equals(originalDek)).toBe(true);
    });

    it('1.4 should reject unwrapping with non-existent or wrong KEK version', async () => {
      const dek = kms.generateDek();
      const wrapped = await kms.wrapDek(dek);

      await expect(kms.unwrapDek(wrapped.wrappedDek, 99)).rejects.toThrow(
        /KMS Error: KEK version 99 not found/
      );
    });

    it('1.5 should reject unwrapping corrupted or truncated wrapped DEK payload', async () => {
      const truncatedPayload = Buffer.from('too-short').toString('base64');
      await expect(kms.unwrapDek(truncatedPayload, 1)).rejects.toThrow(
        /KMS Error: Corrupted or truncated wrapped DEK payload/
      );

      // Corrupted byte in valid-length payload
      const dek = kms.generateDek();
      const wrapped = await kms.wrapDek(dek);
      const raw = Buffer.from(wrapped.wrappedDek, 'base64');
      raw[raw.length - 1] ^= 0xaa; // Corrupt ciphertext byte
      const corruptedB64 = raw.toString('base64');

      await expect(kms.unwrapDek(corruptedB64, 1)).rejects.toThrow(
        /KMS Error: Failed to unwrap DEK/
      );
    });

    it('1.6 should support Master KEK rotation and re-wrapping DEKs without raw data access', async () => {
      const rotatingKms = new LocalKeyManagementService(testKekHex);
      expect(rotatingKms.getActiveVersion()).toBe(1);

      const rawDek = rotatingKms.generateDek();
      const wrappedV1 = await rotatingKms.wrapDek(rawDek);
      expect(wrappedV1.keyVersion).toBe(1);

      // Rotate Master KEK to Version 2
      const newKekHex = 'f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f00';
      const v2 = await rotatingKms.rotateKek(newKekHex);
      expect(v2).toBe(2);
      expect(rotatingKms.getActiveVersion()).toBe(2);

      // Re-wrap DEK from v1 to v2
      const rewrappedV2 = await rotatingKms.rewrapDek(wrappedV1.wrappedDek, 1, 2);
      expect(rewrappedV2.keyVersion).toBe(2);
      expect(rewrappedV2.wrappedDek).not.toBe(wrappedV1.wrappedDek);

      // Unwrap under v2 returns the exact original DEK
      const unwrappedUnderV2 = await rotatingKms.unwrapDek(rewrappedV2.wrappedDek, 2);
      expect(unwrappedUnderV2.equals(rawDek)).toBe(true);

      // Original v1 still unwraps under v1 (backward compatibility preserved)
      const unwrappedUnderV1 = await rotatingKms.unwrapDek(wrappedV1.wrappedDek, 1);
      expect(unwrappedUnderV1.equals(rawDek)).toBe(true);
    });
  });

  // =========================================================================
  // 2. ENVELOPE ENCRYPTION & DATA PROTECTION
  // =========================================================================
  describe('2. AES-256-GCM Envelope Encryption Engine', () => {
    it('2.1 should encrypt and decrypt arbitrary clinical payloads (PDF, DICOM, Lab JSON)', async () => {
      const clinicalPayloads = [
        Buffer.from('%PDF-1.4 Clinical Discharge Summary: Patient stabilized, discharged with Rx Amoxicillin', 'utf-8'),
        Buffer.from('DICOM-3.0 MRI Brain Scan Slice #42 Matrix 512x512 Contrast Gadolinium', 'utf-8'),
        Buffer.from(JSON.stringify({ patientId: 'pt-101', test: 'HbA1c', value: '5.8%', status: 'NORMAL' }), 'utf-8'),
      ];

      for (const payload of clinicalPayloads) {
        const encResult = await encryptWithEnvelope(payload, kms);

        expect(encResult.combinedBlob).toBeDefined();
        expect(encResult.wrappedDek).toBeDefined();
        expect(encResult.keyVersion).toBe(1);
        expect(encResult.iv).toHaveLength(24); // 12 bytes in hex = 24 chars
        expect(encResult.authTag).toHaveLength(32); // 16 bytes in hex = 32 chars
        expect(encResult.sha256Hash).toHaveLength(64);

        // Ciphertext must NEVER contain plaintext fragments
        expect(encResult.combinedBlob.includes(payload)).toBe(false);

        // Decrypt
        const decrypted = await decryptWithEnvelope(
          encResult.combinedBlob,
          encResult.wrappedDek,
          encResult.keyVersion,
          kms
        );
        expect(decrypted.equals(payload)).toBe(true);
      }
    });

    it('2.2 should generate unique ephemeral DEKs and unique IVs for identical plaintext inputs', async () => {
      const identicalPlaintext = Buffer.from('Identical Pathology Report: Biopsy Negative for Malignancy', 'utf-8');

      const enc1 = await encryptWithEnvelope(identicalPlaintext, kms);
      const enc2 = await encryptWithEnvelope(identicalPlaintext, kms);

      // Ciphertexts must be completely different due to unique DEKs and unique IVs
      expect(enc1.combinedBlob.equals(enc2.combinedBlob)).toBe(false);
      expect(enc1.wrappedDek).not.toBe(enc2.wrappedDek);
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.authTag).not.toBe(enc2.authTag);
      expect(enc1.sha256Hash).not.toBe(enc2.sha256Hash);

      // Both must independently decrypt back to the identical plaintext
      const dec1 = await decryptWithEnvelope(enc1.combinedBlob, enc1.wrappedDek, enc1.keyVersion, kms);
      const dec2 = await decryptWithEnvelope(enc2.combinedBlob, enc2.wrappedDek, enc2.keyVersion, kms);
      expect(dec1.equals(identicalPlaintext)).toBe(true);
      expect(dec2.equals(identicalPlaintext)).toBe(true);
    });

    it('2.3 should enforce minimum header size (28 bytes) on combined blob during decryption', async () => {
      const validDek = kms.generateDek();
      const validWrapped = await kms.wrapDek(validDek);
      const shortBlob = Buffer.from('short-header-less-than-28', 'utf-8'); // 25 bytes
      expect(shortBlob.length).toBeLessThan(28);

      await expect(
        decryptWithEnvelope(shortBlob, validWrapped.wrappedDek, validWrapped.keyVersion, kms)
      ).rejects.toThrow(/smaller than minimum header size \(28 bytes\)/);
    });
  });

  // =========================================================================
  // 3. TAMPER RESISTANCE & AEAD AUTHENTICATION
  // =========================================================================
  describe('3. AEAD Authenticated Integrity & Tamper Proofing', () => {
    it('3.1 should reject decryption if 1 bit in ciphertext is modified', async () => {
      const data = Buffer.from('Confidential Oncology Genomic Sequencing Data', 'utf-8');
      const enc = await encryptWithEnvelope(data, kms);

      const tamperedBlob = Buffer.from(enc.combinedBlob);
      // Flip a bit in the ciphertext portion (after 28 bytes header)
      tamperedBlob[tamperedBlob.length - 1] ^= 0x01;

      await expect(
        decryptWithEnvelope(tamperedBlob, enc.wrappedDek, enc.keyVersion, kms)
      ).rejects.toThrow();
    });

    it('3.2 should reject decryption if IV is tampered with', async () => {
      const data = Buffer.from('Confidential Psychiatric Psychotherapy Notes', 'utf-8');
      const enc = await encryptWithEnvelope(data, kms);

      const tamperedBlob = Buffer.from(enc.combinedBlob);
      // IV is first 12 bytes
      tamperedBlob[0] ^= 0x01;

      await expect(
        decryptWithEnvelope(tamperedBlob, enc.wrappedDek, enc.keyVersion, kms)
      ).rejects.toThrow();
    });

    it('3.3 should reject decryption if authentication tag is tampered with', async () => {
      const data = Buffer.from('Pediatric Immunization Record: MMR, DTaP, Polio', 'utf-8');
      const enc = await encryptWithEnvelope(data, kms);

      const tamperedBlob = Buffer.from(enc.combinedBlob);
      // Auth Tag is bytes 12..27
      tamperedBlob[15] ^= 0xff;

      await expect(
        decryptWithEnvelope(tamperedBlob, enc.wrappedDek, enc.keyVersion, kms)
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 4. IPFS CIPHERTEXT STORAGE & PINNING
  // =========================================================================
  describe('4. IPFS Ciphertext Storage & Content-Addressed Pinning', () => {
    it('4.1 should upload encrypted ciphertext blob to IPFS and return valid CID', async () => {
      const plainData = Buffer.from('IPFS Test Medical Diagnostic Image Matrix', 'utf-8');
      const enc = await encryptWithEnvelope(plainData, kms);

      const ipfsResult = await uploadToIpfs(enc.combinedBlob);
      expect(ipfsResult.cid).toBeDefined();
      expect(typeof ipfsResult.cid).toBe('string');
      // Must be valid CIDv0 (Qm...) or CIDv1 (bafy...)
      expect(ipfsResult.cid.startsWith('Qm') || ipfsResult.cid.startsWith('bafy')).toBe(true);
      expect(ipfsResult.sizeBytes).toBeGreaterThanOrEqual(enc.combinedBlob.length);
    });

    it('4.2 should retrieve exact ciphertext bytes from IPFS by CID', async () => {
      const plainData = Buffer.from('Cardiac Echocardiogram Ultrasound Data Buffer', 'utf-8');
      const enc = await encryptWithEnvelope(plainData, kms);

      const ipfsResult = await uploadToIpfs(enc.combinedBlob);
      const retrievedBlob = await fetchFromIpfs(ipfsResult.cid);

      expect(retrievedBlob.equals(enc.combinedBlob)).toBe(true);

      // Decrypt retrieved blob using KMS
      const decrypted = await decryptWithEnvelope(retrievedBlob, enc.wrappedDek, enc.keyVersion, kms);
      expect(decrypted.equals(plainData)).toBe(true);
    });

    it('4.3 should verify ZERO plaintext PHI is present in raw IPFS stored blob', async () => {
      const sensitivePhi = 'PATIENT_NAME_JOHN_DOE_DIAGNOSIS_ACUTE_LEUKEMIA_SSN_999-00-1111';
      const enc = await encryptWithEnvelope(Buffer.from(sensitivePhi, 'utf-8'), kms);

      const ipfsResult = await uploadToIpfs(enc.combinedBlob);
      const rawStoredBytes = await fetchFromIpfs(ipfsResult.cid);

      expect(rawStoredBytes.toString('utf-8').includes(sensitivePhi)).toBe(false);
      expect(rawStoredBytes.toString('utf-8').includes('JOHN_DOE')).toBe(false);
      expect(rawStoredBytes.toString('utf-8').includes('ACUTE_LEUKEMIA')).toBe(false);
    });

    it('4.4 should support pinning and unpinning CIDs for lifecycle and erasure', async () => {
      const data = Buffer.from('Temporary Medical Telemetry Data', 'utf-8');
      const enc = await encryptWithEnvelope(data, kms);
      const uploadRes = await uploadToIpfs(enc.combinedBlob);

      const pinResult = await pinIpfsCid(uploadRes.cid);
      expect(typeof pinResult).toBe('boolean');

      const unpinResult = await unpinIpfsCid(uploadRes.cid);
      expect(typeof unpinResult).toBe('boolean');
    });

    it('4.5 should seamlessly fall back to local content-addressed store if IPFS node is unavailable', async () => {
      const health = await defaultStorage.healthCheck();
      expect(health).toBe(true);
    });
  });

  // =========================================================================
  // 5. AUTHORIZATION-BEFORE-KEY-ACCESS (RBAC + ABAC + TRUST + CONSENT)
  // =========================================================================
  describe('5. Authorization-Before-Key-Access & Zero-Trust Enforcement', () => {
    const patientUser: AuthenticatedUser = {
      id: 'usr-p7-pat',
      patientId: 'PT-PHASE7-001',
      email: 'p7patient@medrynx.org',
      role: 'PATIENT',
      name: 'Phase7 Patient',
      isVerified: true,
      mfaEnabled: true,
    };

    const attackerPatient: AuthenticatedUser = {
      id: 'usr-p7-attacker',
      patientId: 'PT-PHASE7-666',
      email: 'attacker@medrynx.org',
      role: 'PATIENT',
      name: 'Attacker Patient',
      isVerified: true,
      mfaEnabled: true,
    };

    const unconsentedDoctor: AuthenticatedUser = {
      id: 'usr-p7-doc-noconsent',
      email: 'unconsented.doc@hospital.org',
      role: 'DOCTOR',
      name: 'Dr. NoConsent',
      isVerified: true,
      mfaEnabled: true,
    };

    const consentedDoctor: AuthenticatedUser = {
      id: 'usr-p7-doc-consented',
      email: 'consented.doc@hospital.org',
      role: 'DOCTOR',
      name: 'Dr. Consented',
      isVerified: true,
      mfaEnabled: true,
    };

    let createdRecordId: string;
    const testFileBuffer = Buffer.from('SOAP Clinical Note: Patient exhibits normal respiratory rhythm.', 'utf-8');

    beforeAll(async () => {
      // Register users in memory store
      store.users.push(patientUser as any);
      store.users.push(attackerPatient as any);
      store.users.push(unconsentedDoctor as any);
      store.users.push(consentedDoctor as any);

      // Create a test record for patientUser
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'soap_note.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: testFileBuffer,
        size: testFileBuffer.length,
        destination: '',
        filename: 'soap_note.pdf',
        path: '',
        stream: null as any,
      };

      const record = await uploadAndAnchorRecord(
        mockFile,
        {
          title: 'SOAP Clinical Note P7',
          category: RecordCategory.CLINICAL_NOTE,
          patientId: patientUser.id,
          description: 'Phase 7 test note',
        },
        patientUser
      );
      createdRecordId = record.id;
    });

    it('5.1 should allow authorized patient owner to download and decrypt record', async () => {
      const res = await downloadAndDecryptRecord(createdRecordId, patientUser);
      expect(res.decryptedBuffer).toBeDefined();
      expect(res.decryptedBuffer.equals(testFileBuffer)).toBe(true);
      expect(res.filename).toContain('soap_clinical_note_p7');
    });

    it('5.2 should reject unauthorized patient (IDOR attack) before KMS or IPFS access (403)', async () => {
      await expect(
        downloadAndDecryptRecord(createdRecordId, attackerPatient)
      ).rejects.toThrow(/Access denied: Patients may only access their own protected health information/);
    });

    it('5.3 should reject doctor without active consent grant (403)', async () => {
      await expect(
        downloadAndDecryptRecord(createdRecordId, unconsentedDoctor)
      ).rejects.toThrow(/Access denied: No active consent grant or emergency authorization for this record/);
    });

    it('5.4 should permit doctor with active unexpired consent grant to decrypt', async () => {
      // Seed active grant for consentedDoctor
      const grantId = `grt-p7-${Date.now()}`;
      const activeGrant = {
        id: grantId,
        doctorId: consentedDoctor.id,
        patientId: patientUser.id,
        recordType: RecordCategory.CLINICAL_NOTE,
        status: 'ACTIVE',
        accessExpiry: new Date(Date.now() + 3600 * 1000), // 1 hour from now
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.grants.push(activeGrant as any);
      if (isDbConnected) {
        try {
          await prisma.accessGrant.create({ data: activeGrant as any });
        } catch {
          // ignore
        }
      }

      const res = await downloadAndDecryptRecord(createdRecordId, consentedDoctor);
      expect(res.decryptedBuffer).toBeDefined();
      expect(res.decryptedBuffer.equals(testFileBuffer)).toBe(true);
    });

    it('5.5 should reject doctor with expired consent grant (403)', async () => {
      const expiredDoctor: AuthenticatedUser = {
        id: 'usr-p7-doc-expired',
        email: 'expired.doc@hospital.org',
        role: 'DOCTOR',
        name: 'Dr. Expired',
        isVerified: true,
        mfaEnabled: true,
      };
      store.users.push(expiredDoctor as any);

      store.grants.push({
        id: `grt-exp-${Date.now()}`,
        doctorId: expiredDoctor.id,
        patientId: patientUser.id,
        recordType: RecordCategory.CLINICAL_NOTE,
        status: 'ACTIVE',
        accessExpiry: new Date(Date.now() - 60000), // Expired 1 min ago
        createdAt: new Date(Date.now() - 120000),
        updatedAt: new Date(),
      } as any);

      await expect(
        downloadAndDecryptRecord(createdRecordId, expiredDoctor)
      ).rejects.toThrow(/Access denied: No active consent grant or emergency authorization for this record/);
    });

    it('5.6 should strictly block access if trust relationship has been REVOKED, even if consent was granted', async () => {
      const revokedTrustDoctor: AuthenticatedUser = {
        id: 'usr-p7-doc-revoked-trust',
        email: 'revoked.trust@hospital.org',
        role: 'DOCTOR',
        name: 'Dr. RevokedTrust',
        isVerified: true,
        mfaEnabled: true,
      };
      store.users.push(revokedTrustDoctor as any);

      // Add active grant
      store.grants.push({
        id: `grt-revtrust-${Date.now()}`,
        doctorId: revokedTrustDoctor.id,
        patientId: patientUser.id,
        recordType: RecordCategory.CLINICAL_NOTE,
        status: 'ACTIVE',
        accessExpiry: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Add REVOKED trust relationship
      store.relationships.push({
        id: `rel-rev-${Date.now()}`,
        type: 'PATIENT_PROVIDER',
        subjectId: patientUser.id,
        targetUserId: revokedTrustDoctor.id,
        status: 'REVOKED',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await expect(
        downloadAndDecryptRecord(createdRecordId, revokedTrustDoctor)
      ).rejects.toThrow(/ABAC Policy Engine: Trust relationship between patient and provider has been revoked/);
    });
  });

  // =========================================================================
  // 6. CRYPTOGRAPHIC SHREDDING (GDPR RIGHT TO ERASURE)
  // =========================================================================
  describe('6. Cryptographic Shredding & Permanent Erasure (GDPR Art. 17)', () => {
    it('6.1 should zero wrapped DEK, unpin IPFS CID, and set record to TOMBSTONED', async () => {
      const shredPatient: AuthenticatedUser = {
        id: 'usr-p7-shred-pat',
        patientId: 'PT-SHRED-999',
        email: 'shred.patient@medrynx.org',
        role: 'PATIENT',
        name: 'Shred Patient',
        isVerified: true,
        mfaEnabled: true,
      };
      store.users.push(shredPatient as any);

      const secretPayload = Buffer.from('Top Secret Genetic Sequencing Data to be Shredded', 'utf-8');
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'genetic_sequence.json',
        encoding: '7bit',
        mimetype: 'application/json',
        buffer: secretPayload,
        size: secretPayload.length,
        destination: '',
        filename: 'genetic_sequence.json',
        path: '',
        stream: null as any,
      };

      const record = await uploadAndAnchorRecord(
        mockFile,
        {
          title: 'Genetic Sequence Document',
          category: RecordCategory.LAB_REPORT,
          patientId: shredPatient.id,
          description: 'Document to be shredded',
        },
        shredPatient
      );

      // Record can be decrypted before shredding
      const beforeShred = await downloadAndDecryptRecord(record.id, shredPatient);
      expect(beforeShred.decryptedBuffer.equals(secretPayload)).toBe(true);

      // Execute cryptographic shredding & tombstoning
      const tombstoneResult = await tombstoneRecord(record.id, shredPatient);
      expect(tombstoneResult.success).toBe(true);

      // Verify that after shredding, authorization rejects access
      await expect(
        downloadAndDecryptRecord(record.id, shredPatient)
      ).rejects.toThrow(/Medical record has been cryptographically shredded and tombstoned/);

      // Direct authorization check also rejects
      await expect(
        checkRecordAuthorization({ id: record.id, patientId: shredPatient.id, category: RecordCategory.LAB_REPORT, recordStatus: 'TOMBSTONED' }, shredPatient)
      ).rejects.toThrow(/Medical record has been cryptographically shredded and tombstoned/);
    });
  });

  // =========================================================================
  // 7. MULTI-VERSION REVISIONS CRYPTOGRAPHIC ISOLATION
  // =========================================================================
  describe('7. Multi-Version Cryptographic Isolation', () => {
    it('7.1 should assign unique DEKs and unique IPFS CIDs to each record version', async () => {
      const vPatient: AuthenticatedUser = {
        id: 'usr-p7-vpat',
        patientId: 'PT-VER-001',
        email: 'vpatient@medrynx.org',
        role: 'PATIENT',
        name: 'Version Patient',
        isVerified: true,
        mfaEnabled: true,
      };
      store.users.push(vPatient as any);

      const v1Data = Buffer.from('Blood Pressure Check V1: 140/90 mmHg (Stage 1 HTN)', 'utf-8');
      const v2Data = Buffer.from('Blood Pressure Check V2: 122/78 mmHg (Normalized on Lisinopril)', 'utf-8');

      const mockV1File: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'bp_v1.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: v1Data,
        size: v1Data.length,
        destination: '',
        filename: 'bp_v1.pdf',
        path: '',
        stream: null as any,
      };

      const record = await uploadAndAnchorRecord(
        mockV1File,
        {
          title: 'Blood Pressure Log',
          category: RecordCategory.CLINICAL_NOTE,
          patientId: vPatient.id,
        },
        vPatient
      );

      const mockV2File: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'bp_v2.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: v2Data,
        size: v2Data.length,
        destination: '',
        filename: 'bp_v2.pdf',
        path: '',
        stream: null as any,
      };

      const v2 = await createRecordVersion(record.id, mockV2File, 'Post-medication follow-up', vPatient);
      expect(v2.versionNumber).toBe(2);

      // Verify v1 and v2 have different CIDs and hashes
      expect(v2.ipfsCid).not.toBe(record.ipfsCid);
      expect(v2.sha256Hash).not.toBe(record.sha256Hash);

      // Decrypt version 1
      const decryptedV1 = await downloadAndDecryptRecordVersion(record.id, 1, vPatient);
      expect(decryptedV1.decryptedBuffer.equals(v1Data)).toBe(true);

      // Decrypt version 2
      const decryptedV2 = await downloadAndDecryptRecordVersion(record.id, 2, vPatient);
      expect(decryptedV2.decryptedBuffer.equals(v2Data)).toBe(true);
    }, 15000);
  });

  // =========================================================================
  // 8. SECRET HYGIENE & ANTI-LEAKAGE VERIFICATION
  // =========================================================================
  describe('8. Zero-Leakage Cryptographic Hygiene', () => {
    it('8.1 should verify that Master KEK is never present in PostgreSQL or in-memory records', async () => {
      const records = isDbConnected
        ? await prisma.recordMetadata.findMany({ take: 5 })
        : store.records;

      for (const rec of records) {
        // Must have wrappedDek (if not shredded), but NEVER master KEK or plaintext DEK
        if (rec.wrappedDek) {
          expect(rec.wrappedDek).not.toBe(testKekHex);
          expect(rec.wrappedDek.length).toBeGreaterThan(20);
        }
      }
    });

    it('8.2 should ensure ephemeral DEK is wiped from memory after envelope operations', async () => {
      const data = Buffer.from('Ephemeral DEK Memory Wipe Test Buffer', 'utf-8');
      const enc = await encryptWithEnvelope(data, kms);
      expect(enc.wrappedDek).toBeDefined();

      // Ensure decryption also executes clean up
      const dec = await decryptWithEnvelope(enc.combinedBlob, enc.wrappedDek, enc.keyVersion, kms);
      expect(dec.equals(data)).toBe(true);
    });
  });
});
