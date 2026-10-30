import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../models/db';
import { signToken } from '../utils/jwt';
import { encryptAes256Gcm, decryptAes256Gcm, computeSha256 } from '../utils/crypto';
import { uploadToIpfs } from '../services/ipfs.service';
import { RecordCategory, RecordFileType, StorageStatus } from '@prisma/client';

// Mock database and IPFS service if needed
vi.mock('../models/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    recordMetadata: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    accessGrant: {
      findFirst: vi.fn(),
    },
    emergencyEvent: {
      findFirst: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    trustRelationship: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
  connectDatabase: vi.fn(),
  isDbConnected: true,
}));

describe('Medical Records & Encrypted Storage Module', () => {
  const patientUser = {
    id: 'pt-1111-uuid',
    name: 'Karna Sharma',
    email: 'karna@medrynx.org',
    role: 'PATIENT' as const,
    patientId: 'PT-98234',
  };

  const doctorUser = {
    id: 'doc-2222-uuid',
    name: 'Dr. Ananya Sharma',
    email: 'doctor@medrynx.org',
    role: 'DOCTOR' as const,
    doctorId: 'd-201',
    hospital: 'ABC Hospital',
  };

  const patientToken = signToken({
    id: patientUser.id,
    email: patientUser.email,
    role: patientUser.role,
    patientId: patientUser.patientId,
  });

  const doctorToken = signToken({
    id: doctorUser.id,
    email: doctorUser.email,
    role: doctorUser.role,
    doctorId: doctorUser.doctorId,
    hospital: doctorUser.hospital,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Cryptographic Engine (AES-256-GCM & SHA-256)', () => {
    it('should encrypt and decrypt binary data symmetrically without data loss', () => {
      const originalText = 'CONFIDENTIAL_EHR_DATA: Patient has penicillin allergy. Blood Group: O+';
      const originalBuffer = Buffer.from(originalText, 'utf-8');

      // 1. Encrypt
      const encrypted = encryptAes256Gcm(originalBuffer);
      expect(encrypted.combinedBlob).not.toEqual(originalBuffer);
      expect(encrypted.combinedBlob.length).toBeGreaterThan(originalBuffer.length);

      // 2. Compute SHA-256 hash of encrypted blob
      const hash1 = computeSha256(encrypted.combinedBlob);
      const hash2 = computeSha256(encrypted.combinedBlob);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // Hex-encoded 256 bits

      // 3. Decrypt
      const decryptedBuffer = decryptAes256Gcm(encrypted.combinedBlob);
      expect(decryptedBuffer.toString('utf-8')).toBe(originalText);
    });

    it('should fail decryption if encrypted blob is tampered', () => {
      const originalBuffer = Buffer.from('Sensitive Health Record', 'utf-8');
      const encrypted = encryptAes256Gcm(originalBuffer);

      // Tamper ciphertext byte
      encrypted.combinedBlob[encrypted.combinedBlob.length - 1] ^= 0xff;

      expect(() => decryptAes256Gcm(encrypted.combinedBlob)).toThrow();
    });
  });

  describe('POST /api/v1/records (Record Upload)', () => {
    it('should require authentication token (401)', async () => {
      const res = await request(app)
        .post('/api/v1/records')
        .field('title', 'Blood Test')
        .field('category', 'Laboratory');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if no file is attached', async () => {
      const res = await request(app)
        .post('/api/v1/records')
        .set('Authorization', `Bearer ${patientToken}`)
        .field('title', 'Blood Test')
        .field('category', 'Laboratory');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('No file uploaded');
    });

    it('should encrypt, anchor to IPFS, and store record metadata for patient', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...patientUser,
        passwordHash: 'hash',
        phone: null,
        avatarUrl: null,
        dob: null,
        gender: null,
        bloodGroup: null,
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
      });

      const mockCreatedRecord = {
        id: 'rec-uuid-1234',
        patientId: patientUser.id,
        title: 'Complete Blood Count (CBC)',
        category: RecordCategory.Laboratory,
        description: 'Routine blood panel',
        fileType: RecordFileType.PDF,
        fileSize: '1.2 MB',
        encryptedIpfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
        sha256Hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        isEncrypted: true,
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        issuingClinician: 'Dr. Priya Rao',
        issuingHospital: 'Care Hospital',
        recordDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.recordMetadata.create).mockResolvedValue(mockCreatedRecord);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const fakePdfBuffer = Buffer.from('%PDF-1.4 Fake Medical Diagnostic Report Content', 'utf-8');

      const res = await request(app)
        .post('/api/v1/records')
        .set('Authorization', `Bearer ${patientToken}`)
        .field('title', 'Complete Blood Count (CBC)')
        .field('category', 'Laboratory')
        .field('description', 'Routine blood panel')
        .attach('file', fakePdfBuffer, 'cbc_report.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        title: 'Complete Blood Count (CBC)',
        category: 'Laboratory',
        isEncrypted: true,
        storageStatus: 'Encrypted & Anchored',
        downloadUrl: `/api/v1/records/${mockCreatedRecord.id}/download`,
      });
      expect(res.body.data.sha256Hash).toBeDefined();
      expect(res.body.data.ipfsCid).toBeDefined();
    });
  });

  describe('GET /api/v1/records (List Records)', () => {
    it('should return list of records belonging to the authenticated patient', async () => {
      const mockRecordsList = [
        {
          id: 'rec-1',
          patientId: patientUser.id,
          title: 'CMP Panel',
          category: RecordCategory.Laboratory,
          description: 'Metabolic panel',
          fileType: RecordFileType.PDF,
          fileSize: '1.4 MB',
          encryptedIpfsHash: 'QmTest1',
          sha256Hash: 'hash1',
          isEncrypted: true,
          storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
          issuingClinician: 'Dr. Ananya Sharma',
          issuingHospital: 'ABC Hospital',
          recordDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          patient: patientUser,
        },
      ];

      vi.mocked(prisma.recordMetadata.findMany).mockResolvedValue(mockRecordsList as any);

      const res = await request(app)
        .get('/api/v1/records')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('CMP Panel');
    });
  });

  describe('GET /api/v1/records/:id/download (Decryption & Scope-bound access)', () => {
    it('should block doctor from downloading when no active consent grant exists (403)', async () => {
      const mockRecord = {
        id: 'rec-restricted-1',
        patientId: patientUser.id,
        title: 'Brain MRI Scan',
        category: RecordCategory.Imaging,
        description: 'Brain MRI',
        fileType: RecordFileType.PDF,
        fileSize: '2.5 MB',
        encryptedIpfsHash: 'QmFakeCid',
        sha256Hash: 'fakehash',
        isEncrypted: true,
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        recordDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        patient: patientUser,
      };

      vi.mocked(prisma.recordMetadata.findUnique).mockResolvedValue(mockRecord as any);
      // No active consent grant
      vi.mocked(prisma.accessGrant.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.emergencyEvent.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/v1/records/${mockRecord.id}/download`)
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow patient to download and decrypt their own record', async () => {
      const plaintext = 'PATIENT LAB RESULT: Glucose 95 mg/dL (Normal).';
      const plaintextBuffer = Buffer.from(plaintext, 'utf-8');
      const encryption = encryptAes256Gcm(plaintextBuffer);
      const sha256Hash = computeSha256(encryption.combinedBlob);

      // Upload to local IPFS test store
      const ipfsUpload = await uploadToIpfs(encryption.combinedBlob);

      const mockRecord = {
        id: 'rec-accessible-1',
        patientId: patientUser.id,
        title: 'Glucose Test',
        category: RecordCategory.Laboratory,
        description: 'Blood sugar analysis',
        fileType: RecordFileType.PDF,
        fileSize: '500 KB',
        encryptedIpfsHash: ipfsUpload.cid,
        sha256Hash,
        isEncrypted: true,
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        recordDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        patient: patientUser,
      };

      vi.mocked(prisma.recordMetadata.findUnique).mockResolvedValue(mockRecord as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get(`/api/v1/records/${mockRecord.id}/download`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.body.toString('utf-8')).toBe(plaintext);
    });
  });
});
