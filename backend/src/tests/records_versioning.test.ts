import { describe, it, expect, beforeEach } from 'vitest';
import {
  uploadAndAnchorRecord,
  createRecordVersion,
  getRecordVersions,
  getRecordVersionById,
  downloadAndDecryptRecordVersion,
  downloadAndDecryptRecord,
  tombstoneRecord,
  getRecordById,
} from '../services/record.service';
import {
  RecordCategory,
  RecordFileType,
  UserRole,
  RelationshipType,
  RelationshipStatus,
} from '@prisma/client';
import { AuthenticatedUser } from '../types/common.types';
import { store } from '../models/store';
import { encryptAes256Gcm, decryptAes256Gcm } from '../utils/crypto';

describe('Medical Records, Provenance & Versioning Subsystem (Phase 6)', () => {
  const patientAlice: AuthenticatedUser = {
    id: 'usr-patient-alice',
    email: 'alice@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-ALICE-01',
    organizationId: 'org-hosp-001',
  };

  const patientBob: AuthenticatedUser = {
    id: 'usr-patient-bob',
    email: 'bob@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-BOB-02',
    organizationId: 'org-hosp-002',
  };

  const doctorDave: AuthenticatedUser = {
    id: 'usr-doctor-dave',
    email: 'dave@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-DAVE-01',
    hospital: 'ABC Hospital',
    organizationId: 'org-hosp-001',
  };

  const doctorEve: AuthenticatedUser = {
    id: 'usr-doctor-eve',
    email: 'eve@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-EVE-02',
    hospital: 'City Clinic',
    organizationId: 'org-hosp-002',
  };

  const createDummyFile = (content: string, filename: string = 'report.pdf'): Express.Multer.File => {
    const buffer = Buffer.from(content, 'utf-8');
    return {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: buffer.length,
      buffer,
      destination: '',
      filename,
      path: '',
      stream: null as any,
    };
  };

  beforeEach(() => {
    // Reset in-memory test store users
    store.users = [
      {
        id: patientAlice.id,
        email: patientAlice.email,
        passwordHash: 'hashed',
        name: 'Alice Patient',
        role: UserRole.PATIENT,
        patientId: patientAlice.patientId,
        organizationId: patientAlice.organizationId,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
      },
      {
        id: patientBob.id,
        email: patientBob.email,
        passwordHash: 'hashed',
        name: 'Bob Patient',
        role: UserRole.PATIENT,
        patientId: patientBob.patientId,
        organizationId: patientBob.organizationId,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
      },
      {
        id: doctorDave.id,
        email: doctorDave.email,
        passwordHash: 'hashed',
        name: 'Dr. Dave Clinician',
        role: UserRole.DOCTOR,
        doctorId: doctorDave.doctorId,
        hospital: doctorDave.hospital,
        organizationId: doctorDave.organizationId,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
      },
      {
        id: doctorEve.id,
        email: doctorEve.email,
        passwordHash: 'hashed',
        name: 'Dr. Eve Specialist',
        role: UserRole.DOCTOR,
        doctorId: doctorEve.doctorId,
        hospital: doctorEve.hospital,
        organizationId: doctorEve.organizationId,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
      },
    ];

    store.records = [];
    store.recordVersions = [];
    store.grants = [];
    store.relationships = [];
  });

  describe('1. Record Ingestion & Version 1 Provenance', () => {
    it('should create initial medical record with Version 1 and envelope encryption metadata', async () => {
      const file = createDummyFile('LAB REPORT: Hemoglobin 14.2 g/dL (Normal).');
      const record = await uploadAndAnchorRecord(
        file,
        {
          title: 'Complete Blood Count (CBC)',
          category: RecordCategory.Laboratory,
          description: 'Routine wellness screening',
        },
        patientAlice
      );

      expect(record.id).toBeDefined();
      expect(record.title).toBe('Complete Blood Count (CBC)');
      expect(record.currentVersion).toBe(1);
      expect(record.recordStatus).toBe('ACTIVE');
      expect(record.ipfsCid).toMatch(/^Qm/);
      expect(record.sha256Hash).toHaveLength(64);
      expect(record.onChainTxHash).toBeDefined();

      // Check Version 1 in version history
      const versions = await getRecordVersions(record.id, patientAlice);
      expect(versions).toHaveLength(1);
      expect(versions[0].versionNumber).toBe(1);
      expect(versions[0].ipfsCid).toBe(record.ipfsCid);
      expect(versions[0].sha256Hash).toBe(record.sha256Hash);
    });

    it('should reject malicious binary executables (PE/MZ header)', async () => {
      // Create executable PE/MZ header (0x4D, 0x5A)
      const maliciousBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00]);
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'malware.exe',
        encoding: '7bit',
        mimetype: 'application/octet-stream',
        size: maliciousBuffer.length,
        buffer: maliciousBuffer,
        destination: '',
        filename: 'malware.exe',
        path: '',
        stream: null as any,
      };

      await expect(
        uploadAndAnchorRecord(
          file,
          {
            title: 'Infected Document',
            category: RecordCategory.Clinical,
          },
          patientAlice
        )
      ).rejects.toThrow('Malicious file upload rejected');
    });
  });

  describe('2. Record Versioning & Revision Immutability', () => {
    it('should create Version 2 with independent DEK and CID without overwriting Version 1', async () => {
      // 1. Initial V1
      const v1File = createDummyFile('V1 DATA: Fasting Blood Glucose = 105 mg/dL');
      const record = await uploadAndAnchorRecord(
        v1File,
        {
          title: 'Glucose Monitoring Panel',
          category: RecordCategory.Laboratory,
        },
        patientAlice
      );

      const v1Cid = record.ipfsCid;
      const v1Hash = record.sha256Hash;

      // 2. Upload V2 Revision
      const v2File = createDummyFile('V2 DATA: Fasting Blood Glucose = 92 mg/dL (Improved)');
      const v2 = await createRecordVersion(
        record.id,
        v2File,
        'Follow-up test after 30 days of lifestyle change',
        patientAlice
      );

      expect(v2.versionNumber).toBe(2);
      expect(v2.ipfsCid).toBeDefined();
      expect(v2.sha256Hash).toBeDefined();
      expect(v2.ipfsCid).not.toBe(v1Cid);
      expect(v2.sha256Hash).not.toBe(v1Hash);

      // Verify updated record points to v2
      const updatedRecord = await getRecordById(record.id, patientAlice);
      expect(updatedRecord.currentVersion).toBe(2);

      // Verify version history retains both v2 and v1
      const versions = await getRecordVersions(record.id, patientAlice);
      expect(versions).toHaveLength(2);
      expect(versions[0].versionNumber).toBe(2);
      expect(versions[1].versionNumber).toBe(1);
      expect(versions[1].ipfsCid).toBe(v1Cid);
    });

    it('should allow authorized downloading of both historical Version 1 and latest Version 2', async () => {
      const v1Text = 'ORIGINAL ECG: Sinus rhythm, heart rate 72 bpm.';
      const v2Text = 'UPDATED ECG: Sinus rhythm with mild sinus arrhythmia, heart rate 68 bpm.';

      const record = await uploadAndAnchorRecord(
        createDummyFile(v1Text),
        { title: 'Cardiology ECG Trace', category: RecordCategory.Cardiology },
        patientAlice
      );

      await createRecordVersion(
        record.id,
        createDummyFile(v2Text),
        'Follow-up trace during stress test',
        patientAlice
      );

      // Download V1
      const v1Download = await downloadAndDecryptRecordVersion(record.id, 1, patientAlice);
      expect(v1Download.decryptedBuffer.toString('utf-8')).toBe(v1Text);

      // Download V2
      const v2Download = await downloadAndDecryptRecordVersion(record.id, 2, patientAlice);
      expect(v2Download.decryptedBuffer.toString('utf-8')).toBe(v2Text);
    });
  });

  describe('3. Ownership, IDOR Isolation & Consent Controls', () => {
    it('should strictly block unauthorized patient (Bob) from accessing Alice records or versions (403)', async () => {
      const record = await uploadAndAnchorRecord(
        createDummyFile('Alice Confidential Genetic Screening'),
        { title: 'Genomic Screening', category: RecordCategory.Genomic },
        patientAlice
      );

      // Bob attempts to get record metadata
      await expect(getRecordById(record.id, patientBob)).rejects.toThrow('Patients may only access their own');

      // Bob attempts to get record version list
      await expect(getRecordVersions(record.id, patientBob)).rejects.toThrow('Patients may only access their own');

      // Bob attempts to download version 1
      await expect(downloadAndDecryptRecordVersion(record.id, 1, patientBob)).rejects.toThrow(
        'Patients may only access their own'
      );
    });

    it('should block doctor without consent from downloading any version (403)', async () => {
      const record = await uploadAndAnchorRecord(
        createDummyFile('Clinical Psychiatric Assessment Notes'),
        { title: 'Psych Assessment', category: RecordCategory.Clinical },
        patientAlice
      );

      // Doctor Dave has NO consent grant
      await expect(downloadAndDecryptRecord(record.id, doctorDave)).rejects.toThrow(
        'No active consent grant or emergency authorization'
      );

      await expect(downloadAndDecryptRecordVersion(record.id, 1, doctorDave)).rejects.toThrow(
        'No active consent grant or emergency authorization'
      );
    });

    it('should permit consented doctor to access and download permitted record versions', async () => {
      const record = await uploadAndAnchorRecord(
        createDummyFile('Laboratory CBC Blood Analysis'),
        { title: 'CBC Panel', category: RecordCategory.Laboratory },
        patientAlice
      );

      // Seed active consent grant for Dave on Laboratory category
      store.grants.push({
        id: 'grant-alice-dave',
        patientId: patientAlice.id,
        doctorId: doctorDave.id,
        recordType: 'Laboratory',
        purpose: 'Diagnosis',
        accessStart: new Date(Date.now() - 3600000),
        accessExpiry: new Date(Date.now() + 86400000),
        status: 'ACTIVE',
        isEmergency: false,
        requiresReconciliation: false,
        isReconciled: false,
        isDisputed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await downloadAndDecryptRecordVersion(record.id, 1, doctorDave);
      expect(res.decryptedBuffer.toString('utf-8')).toBe('Laboratory CBC Blood Analysis');
    });

    it('should block doctor if Trust Relationship has been explicitly REVOKED (ABAC override)', async () => {
      const record = await uploadAndAnchorRecord(
        createDummyFile('Prescription Dosage Record'),
        { title: 'Prescription', category: RecordCategory.Medication },
        patientAlice
      );

      // Seed active consent grant
      store.grants.push({
        id: 'grant-revoked-trust',
        patientId: patientAlice.id,
        doctorId: doctorDave.id,
        recordType: 'Medication',
        purpose: 'Diagnosis',
        accessStart: new Date(Date.now() - 3600000),
        accessExpiry: new Date(Date.now() + 86400000),
        status: 'ACTIVE',
        isEmergency: false,
        requiresReconciliation: false,
        isReconciled: false,
        isDisputed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Seed REVOKED trust relationship
      store.relationships.push({
        id: 'rel-revoked-dave',
        relationshipType: RelationshipType.PATIENT_PROVIDER,
        status: RelationshipStatus.REVOKED,
        subjectId: patientAlice.id,
        targetUserId: doctorDave.id,
        targetOrgId: null,
        department: 'Cardiology',
        careTeamRole: null,
        notes: null,
        onChainTxHash: null,
        onChainId: null,
        expiresAt: null,
        revokedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(downloadAndDecryptRecordVersion(record.id, 1, doctorDave)).rejects.toThrow(
        'Trust relationship between patient and provider has been revoked'
      );
    });
  });

  describe('4. Cryptographic Shredding & Tombstoning (GDPR Article 17)', () => {
    it('should permanently destroy DEK, unpin IPFS, and tombstone record on-chain', async () => {
      const record = await uploadAndAnchorRecord(
        createDummyFile('Sensitive Diagnostic Pathology'),
        { title: 'Pathology Report', category: RecordCategory.Laboratory },
        patientAlice
      );

      // Alice initiates GDPR Right to Erasure / Crypto-shredding
      const shredResult = await tombstoneRecord(record.id, patientAlice);
      expect(shredResult.success).toBe(true);
      expect(shredResult.message).toContain('tombstoned');

      // Check that DEK was zeroed / destroyed in store
      const shreddedRecord = store.records.find((r) => r.id === record.id);
      expect(shreddedRecord?.wrappedDek).toBeNull();
      expect(shreddedRecord?.iv).toBeNull();
      expect(shreddedRecord?.authTag).toBeNull();
      expect(shreddedRecord?.recordStatus).toBe('TOMBSTONED');

      // Subsequent download attempt must be blocked
      await expect(downloadAndDecryptRecord(record.id, patientAlice)).rejects.toThrow(
        'cryptographically shredded and tombstoned'
      );

      // Attempt to create a version on tombstoned record must be blocked
      await expect(
        createRecordVersion(record.id, createDummyFile('New revision'), 'Update', patientAlice)
      ).rejects.toThrow('cryptographically shredded and tombstoned');
    });

    it('should block non-owner third party from executing tombstoning (403)', async () => {
      const record = await uploadAndAnchorRecord(
        createDummyFile('Confidential Record'),
        { title: 'Confidential', category: RecordCategory.Clinical },
        patientAlice
      );

      // Unauthorized third party (Bob) attempts to shred Alice's record
      await expect(tombstoneRecord(record.id, patientBob)).rejects.toThrow(
        'Only the patient owner or system administrator'
      );
    });
  });

  describe('5. Cryptographic Integrity & Tamper Detection', () => {
    it('should reject tampered ciphertext with AES-256-GCM authentication tag mismatch', () => {
      const plaintext = Buffer.from('CONFIDENTIAL MEDICAL RECORD DATA');
      const encryption = encryptAes256Gcm(plaintext);

      // Corrupt 1 byte in the ciphertext payload
      const tamperedBlob = Buffer.from(encryption.combinedBlob);
      tamperedBlob[tamperedBlob.length - 1] ^= 0x01; // Flip 1 bit

      expect(() => decryptAes256Gcm(tamperedBlob)).toThrow();
    });
  });
});
