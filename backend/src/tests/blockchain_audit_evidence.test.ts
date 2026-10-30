import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  sortObjectKeys,
  serializeCanonicalJson,
  computeCanonicalHash,
  computeCanonicalBytes32,
  buildCanonicalEvidencePayload,
} from '../crypto/canonicalHash';
import { blockchainService } from '../services/blockchain.service';
import {
  uploadAndAnchorRecord,
  downloadAndDecryptRecord,
  tombstoneRecord,
} from '../services/record.service';
import {
  createAccessRequest,
  rejectAccessRequest,
} from '../services/request.service';
import {
  grantScopedConsent,
  revokeConsent,
} from '../services/consent.service';
import {
  declareEmergency,
  reconcileEmergencyEvent,
  disputeEmergencyEvent,
} from '../services/emergency.service';
import {
  createTrustRelationship,
  acceptTrustRelationship,
} from '../services/relationship.service';
import {
  getAuditLogs,
  getAuditLogById,
  verifyAuditEvidence,
  verifyRecordIntegrity,
  getEntityBlockchainEvidence,
} from '../services/audit.service';
import { store } from '../models/store';
import { AuthenticatedUser } from '../types/common.types';
import { RecordCategory, UserRole, RequestPurpose, DisputeReason, RelationshipType } from '@prisma/client';

describe('MEDRYNX PHASE 9 — BLOCKCHAIN + AUDIT EVIDENCE LAYER', () => {
  const patientUser: AuthenticatedUser = {
    id: 'usr-patient-test-01',
    email: 'patient.p9@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-P9-001',
    hospital: 'Apollo Medical Center',
  };

  const patient2User: AuthenticatedUser = {
    id: 'usr-patient-test-02',
    email: 'patient2.p9@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-P9-002',
    hospital: 'Fortis Hospital',
  };

  const doctorUser: AuthenticatedUser = {
    id: 'usr-doctor-test-01',
    email: 'dr.sharma.p9@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-P9-001',
    hospital: 'Apollo Medical Center',
  };

  const orgAdminUser: AuthenticatedUser = {
    id: 'usr-admin-test-01',
    email: 'admin.apollo@medrynx.org',
    role: UserRole.ORGANIZATION_ADMIN,
    hospital: 'Apollo Medical Center',
  };

  const systemAdminUser: AuthenticatedUser = {
    id: 'usr-sysadmin-test-01',
    email: 'sysadmin@medrynx.org',
    role: UserRole.ADMIN,
  };

  beforeAll(async () => {
    // Seed store.users
    const usersToSeed = [
      {
        id: patientUser.id,
        patientId: patientUser.patientId!,
        email: patientUser.email,
        name: 'Patient Phase 9',
        role: UserRole.PATIENT,
        hospital: patientUser.hospital,
      },
      {
        id: patient2User.id,
        patientId: patient2User.patientId!,
        email: patient2User.email,
        name: 'Patient Two Phase 9',
        role: UserRole.PATIENT,
        hospital: patient2User.hospital,
      },
      {
        id: doctorUser.id,
        doctorId: doctorUser.doctorId!,
        email: doctorUser.email,
        name: 'Dr. Sharma Phase 9',
        role: UserRole.DOCTOR,
        hospital: doctorUser.hospital,
      },
    ];

    for (const u of usersToSeed) {
      if (!store.users.find((su) => su.id === u.id)) {
        store.users.push(u as any);
      }
    }

    const { prisma, isDbConnected } = await import('../models/db');
    if (isDbConnected) {
      for (const u of usersToSeed) {
        try {
          await prisma.user.upsert({
            where: { id: u.id },
            update: {},
            create: {
              id: u.id,
              email: u.email,
              name: u.name,
              role: u.role,
              patientId: (u as any).patientId || null,
              doctorId: (u as any).doctorId || null,
              hospital: u.hospital,
              passwordHash: 'dummy-password-hash',
            },
          });
        } catch {
          // ignore if already seeded
        }
      }
    }
  });

  // =========================================================================
  // 1. CANONICAL HASHING DETERMINISM & ZERO-PHI EVIDENCE INTEGRITY
  // =========================================================================
  describe('1. Canonical Serialization, Deterministic Hashing & Zero-PHI Invariant', () => {
    it('1.1 should sort object keys alphabetically at all nesting levels', () => {
      const unordered = {
        z: 100,
        a: 'first',
        nested: {
          beta: true,
          alpha: false,
          inner: { zulu: 1, able: 2 },
        },
      };

      const sorted = sortObjectKeys(unordered);
      const keys = Object.keys(sorted);
      expect(keys).toEqual(['a', 'nested', 'z']);
      expect(Object.keys(sorted.nested)).toEqual(['alpha', 'beta', 'inner']);
      expect(Object.keys(sorted.nested.inner)).toEqual(['able', 'zulu']);
    });

    it('1.2 should produce identical canonical JSON and SHA-256 hash regardless of property insertion order', () => {
      const obj1 = {
        patientId: 'PT-001',
        recordType: 'CARDIOLOGY',
        timestamp: '2026-09-23T12:00:00.000Z',
        details: { doctorId: 'DOC-01', purpose: 'Diagnosis' },
      };

      const obj2 = {
        details: { purpose: 'Diagnosis', doctorId: 'DOC-01' },
        timestamp: '2026-09-23T12:00:00.000Z',
        patientId: 'PT-001',
        recordType: 'CARDIOLOGY',
      };

      const hash1 = computeCanonicalHash(obj1);
      const hash2 = computeCanonicalHash(obj2);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('1.3 should format canonical hash into a valid 0x-prefixed 32-byte hex for EVM contracts', () => {
      const payload = { event: 'ACCESS_GRANTED', id: '123' };
      const bytes32 = computeCanonicalBytes32(payload);

      expect(bytes32.startsWith('0x')).toBe(true);
      expect(bytes32.length).toBe(66); // '0x' + 64 hex characters
    });

    it('1.4 should strictly strip PHI (names, notes, diagnoses, prescriptions) from canonical evidence payloads', () => {
      const dirtyEvidence = {
        evidenceType: 'CONSENT_CHANGE',
        entityType: 'CONSENT',
        entityId: 'grant-999',
        patientId: 'PT-001',
        actorId: 'DOC-01',
        action: 'GRANT_CONSENT',
        details: {
          patientName: 'Jane Doe', // SENSITIVE PHI
          notes: 'Patient suffers from stage 2 hypertension', // SENSITIVE PHI
          diagnosis: 'Essential Hypertension', // SENSITIVE PHI
          prescription: 'Lisinopril 10mg daily', // SENSITIVE PHI
          category: 'CARDIOLOGY',
          durationDays: 7,
        },
      };

      const sanitized = buildCanonicalEvidencePayload(dirtyEvidence);
      const serialized = serializeCanonicalJson(sanitized);

      // Verify that NO sensitive PHI exists in the serialized evidence payload
      expect(serialized).not.toContain('Jane Doe');
      expect(serialized).not.toContain('hypertension');
      expect(serialized).not.toContain('Lisinopril');
      expect(serialized).not.toContain('patientName');
      expect(serialized).not.toContain('diagnosis');
      expect(serialized).not.toContain('prescription');

      // Verify that structural metadata is preserved
      expect(sanitized.entityId).toBe('grant-999');
      expect(sanitized.patientId).toBe('PT-001');
      expect(sanitized.action).toBe('GRANT_CONSENT');
      expect(sanitized.details?.category).toBe('CARDIOLOGY');
      expect(sanitized.details?.durationDays).toBe(7);
    });
  });

  // =========================================================================
  // 2. MEDICAL RECORD INTEGRITY, IPFS ANCHORING & CRYPTOGRAPHIC GATING
  // =========================================================================
  describe('2. Medical Record Integrity, IPFS Anchoring & Cryptographic Fail-Closed Gating', () => {
    let createdRecordId: string;
    let expectedHash: string;
    let ipfsCid: string;

    it('2.1 should encrypt, anchor to IPFS, and anchor SHA-256 ciphertext hash to blockchain', async () => {
      const fileBuffer = Buffer.from('CLINICAL REPORT: Cardiac Stress Test Normative. Medrynx 2026.');
      const mockFile = {
        buffer: fileBuffer,
        originalname: 'cardiac_report.txt',
        mimetype: 'text/plain',
        fieldname: 'file',
        encoding: '7bit',
        size: fileBuffer.length,
      } as Express.Multer.File;

      const result = await uploadAndAnchorRecord(
        mockFile,
        {
          title: 'Cardiac Stress Test Normative',
          category: RecordCategory.CARDIOLOGY,
          patientId: patientUser.id,
        },
        doctorUser
      );

      expect(result.id).toBeDefined();
      expect(result.ipfsCid).toBeDefined();
      expect(result.sha256Hash).toBeDefined();
      expect(result.onChainTxHash).toBeDefined();

      createdRecordId = result.id;
      expectedHash = result.sha256Hash;
      ipfsCid = result.ipfsCid;
    });

    it('2.2 should verify cryptographic integrity and allow decryption when ciphertext matches hash', async () => {
      const integrity = await verifyRecordIntegrity(createdRecordId, patientUser);

      expect(integrity.verified).toBe(true);
      expect(integrity.status).toBe('INTEGRITY_VERIFIED');
      expect(integrity.expectedHash).toBe(expectedHash);
      expect(integrity.computedHash).toBe(expectedHash);
      expect(integrity.isTombstoned).toBe(false);

      // Decryption must succeed for authorized patient
      const decrypted = await downloadAndDecryptRecord(createdRecordId, patientUser);
      expect(decrypted.decryptedBuffer.toString('utf8')).toContain('Cardiac Stress Test Normative');
    });

    it('2.3 should fail closed, refuse KMS decryption, and log DISPUTED audit when ciphertext is tampered', async () => {
      // Force tampered bytes into local store cache
      const storageDir = path.resolve(process.cwd(), '.ipfs_storage');
      if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
      }
      fs.writeFileSync(path.join(storageDir, `${ipfsCid}.enc`), Buffer.from('TAMPERED MALICIOUS CIPHERTEXT CONTENT BYPASS ATTEMPT'));

      // Verify integrity check flags tampering immediately
      const integrity = await verifyRecordIntegrity(createdRecordId, patientUser);
      expect(integrity.verified).toBe(false);
      expect(integrity.status).toBe('TAMPERED');
      expect(integrity.computedHash).not.toBe(expectedHash);

      // Download must fail closed and refuse decryption
      await expect(downloadAndDecryptRecord(createdRecordId, patientUser)).rejects.toThrow(
        /integrity verification failed/i
      );

      // Verify tamper audit log was logged with DISPUTED status
      const auditLogs = await getAuditLogs({ patientId: patientUser.id });
      const tamperLog = auditLogs.find((l) => l.purpose?.includes('Record Integrity Verification Failure'));
      expect(tamperLog).toBeDefined();
      expect(tamperLog?.status).toBe('DISPUTED');
    });
  });

  // =========================================================================
  // 3. CONSENT LIFECYCLE ON-CHAIN EVIDENCE ANCHORING
  // =========================================================================
  describe('3. Dynamic Consent Lifecycle On-Chain Evidence Anchoring', () => {
    let grantId: string;
    let grantTxHash: string;

    it('3.1 should anchor scope-bound consent to MedrynxAccessRegistry with block number and evidence hash', async () => {
      const grant = await grantScopedConsent(
        {
          doctorId: doctorUser.id,
          recordType: 'Cardiology',
          purpose: 'Consultation & Second Opinion',
          durationDays: 14,
        },
        patientUser
      );

      expect(grant.id).toBeDefined();
      expect(grant.onChainTxHash).toBeDefined();
      expect(grant.onChainGrantId).toBeDefined();
      expect(grant.status).toBe('ACTIVE');

      grantId = grant.id;
      grantTxHash = grant.onChainTxHash!;

      // Check on-chain tx confirmation
      const txCheck = await blockchainService.verifyTransactionOnChain(grantTxHash);
      expect(txCheck.exists).toBe(true);
      expect(txCheck.confirmed).toBe(true);
      expect(txCheck.status).toBe(1);
    });

    it('3.2 should anchor immediate on-chain revocation and log immutable audit trail', async () => {
      // Allow block settlement
      await new Promise((r) => setTimeout(r, 150));

      const revoked = await revokeConsent(grantId, patientUser);

      expect(revoked.status).toBe('REVOKED');
      expect(revoked.revokedAt).toBeDefined();

      const auditLogs = await getAuditLogs({ patientId: patientUser.id });
      const revokeLog = auditLogs.find((l) => l.onChainEventName === 'CONSENT_REVOKED' || l.details?.grantId === grantId);
      expect(revokeLog).toBeDefined();
      expect(revokeLog?.txHash).toBeDefined();

      // Verify audit proof for revocation
      const verification = await verifyAuditEvidence(revokeLog!.id, patientUser);
      expect(verification.verified).toBe(true);
      expect(verification.blockNumber).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 4. ACCESS REQUEST LIFECYCLE ANCHORING
  // =========================================================================
  describe('4. Access Request Lifecycle On-Chain Anchoring (CREATED & REJECTED)', () => {
    let createdRequestId: string;

    it('4.1 should anchor access request creation on-chain with evidence hash', async () => {
      const req = await createAccessRequest(
        {
          patientId: patientUser.id,
          recordType: 'Cardiology',
          purpose: RequestPurpose.Diagnosis,
          durationDays: 7,
        },
        doctorUser
      );

      expect(req.id).toBeDefined();
      expect(req.status).toBe('PENDING');

      createdRequestId = req.id;

      // Verify audit log exists with on-chain event
      const auditLogs = await getAuditLogs({ patientId: patientUser.id });
      const createReqAudit = auditLogs.find(
        (l) => l.onChainEventName === 'ACCESS_REQUEST_CREATED' && l.details?.requestId === createdRequestId
      );
      expect(createReqAudit).toBeDefined();
      expect(createReqAudit?.txHash).toBeDefined();

      const verification = await verifyAuditEvidence(createReqAudit!.id, patientUser);
      expect(verification.verified).toBe(true);
    });

    it('4.2 should anchor access request rejection on-chain', async () => {
      // Allow block settlement
      await new Promise((r) => setTimeout(r, 150));

      const rejected = await rejectAccessRequest(createdRequestId, patientUser);
      expect(rejected.status).toBe('REJECTED');

      const auditLogs = await getAuditLogs({ patientId: patientUser.id });
      const rejectAudit = auditLogs.find(
        (l) => l.onChainEventName === 'ACCESS_REQUEST_REJECTED' && l.details?.requestId === createdRequestId
      );
      expect(rejectAudit).toBeDefined();
      expect(rejectAudit?.txHash).toBeDefined();

      const verification = await verifyAuditEvidence(rejectAudit!.id, patientUser);
      expect(verification.verified).toBe(true);
    });
  });

  // =========================================================================
  // 5. EMERGENCY BREAK-GLASS LIFECYCLE ANCHORING
  // =========================================================================
  describe('5. Emergency Break-Glass On-Chain Lifecycle (DECLARE -> RECONCILE -> DISPUTE)', () => {
    let emergencyEventId: string;
    let emergencyTxHash: string;

    it('5.1 should anchor emergency break-glass declaration to MedrynxEmergencyVault', async () => {
      const event = await declareEmergency(
        {
          patientId: patientUser.id,
          tier: 'PARTIAL',
          reason: 'Acute myocardial infarction requiring immediate emergency intervention',
        },
        doctorUser
      );

      expect(event.id).toBeDefined();
      expect(event.onChainTxHash).toBeDefined();

      emergencyEventId = event.id;
      emergencyTxHash = event.onChainTxHash;

      // Verify on-chain confirmation
      const onChain = await blockchainService.verifyTransactionOnChain(emergencyTxHash);
      expect(onChain.exists).toBe(true);
      expect(onChain.confirmed).toBe(true);
    });

    it('5.2 should anchor emergency reconciliation on-chain', async () => {
      await new Promise((r) => setTimeout(r, 150));

      const reconciled = await reconcileEmergencyEvent(emergencyEventId, patientUser);

      expect(reconciled.reconciliationStatus).toBe('ACKNOWLEDGED');

      const auditLogs = await getAuditLogs({ patientId: patientUser.id });
      const reconcileAudit = auditLogs.find(
        (l) => l.details?.emergencyId === emergencyEventId && l.details?.status === 'ACKNOWLEDGED'
      );
      expect(reconcileAudit).toBeDefined();
      expect(reconcileAudit?.txHash).toBeDefined();
    });

    it('5.3 should anchor emergency dispute on-chain if contested by patient', async () => {
      await new Promise((r) => setTimeout(r, 150));

      const disputed = await disputeEmergencyEvent(
        {
          emergencyEventId,
          reason: DisputeReason.Unauthorized_Access,
          details: 'Patient claims no clinical emergency occurred at the declared time.',
        },
        patientUser
      );

      expect(disputed.id).toBeDefined();
      expect(disputed.status).toBe('OPEN');

      const auditLogs = await getAuditLogs({ patientId: patientUser.id });
      const disputeAudit = auditLogs.find((l) => l.details?.emergencyId === emergencyEventId && l.accessType === 'DISPUTE');
      expect(disputeAudit).toBeDefined();
      expect(disputeAudit?.txHash).toBeDefined();
    });
  });

  // =========================================================================
  // 6. TRUST RELATIONSHIP LIFECYCLE ON-CHAIN ANCHORING
  // =========================================================================
  describe('6. Trust Relationship Lifecycle On-Chain Anchoring', () => {
    let relationshipId: string;

    it('6.1 should anchor trust relationship request and acceptance on-chain', async () => {
      const rel = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorUser.id,
        },
        patientUser
      );

      expect(rel.id).toBeDefined();
      relationshipId = rel.id;

      await new Promise((r) => setTimeout(r, 150));

      // Doctor accepts trust relationship
      const accepted = await acceptTrustRelationship(relationshipId, doctorUser);
      expect(accepted.status).toBe('ACTIVE');

      const evidence = await getEntityBlockchainEvidence('RELATIONSHIP', relationshipId, patientUser);
      expect(evidence.length).toBeGreaterThan(0);
      expect(evidence[0].txHash).toBeDefined();
    });
  });

  // =========================================================================
  // 7. GDPR RIGHT TO ERASURE / TOMBSTONE EVIDENCE
  // =========================================================================
  describe('7. GDPR Right to Erasure / Cryptographic Deletion Tombstone', () => {
    let tombstoneRecordId: string;

    beforeAll(async () => {
      const fileBuffer = Buffer.from('SENSITIVE TEST RECORD FOR GDPR DELETION');
      const mockFile = {
        buffer: fileBuffer,
        originalname: 'gdpr_deletion_test.txt',
        mimetype: 'text/plain',
        fieldname: 'file',
        encoding: '7bit',
        size: fileBuffer.length,
      } as Express.Multer.File;

      const res = await uploadAndAnchorRecord(
        mockFile,
        {
          title: 'GDPR Right to Erasure Target',
          category: RecordCategory.GENERAL,
          patientId: patientUser.id,
        },
        patientUser
      );
      tombstoneRecordId = res.id;
    });

    it('7.1 should cryptographically destroy DEK, tombstone record, and anchor tombstone on-chain', async () => {
      await new Promise((r) => setTimeout(r, 150));

      const result = await tombstoneRecord(tombstoneRecordId, patientUser);

      expect(result.success).toBe(true);
      expect(result.txHash).toBeDefined();

      // Verify on-chain confirmation of tombstone
      const txCheck = await blockchainService.verifyTransactionOnChain(result.txHash!);
      expect(txCheck.exists).toBe(true);
      expect(txCheck.confirmed).toBe(true);
    });

    it('7.2 should verify that tombstoned record is flagged correctly without exposing PHI', async () => {
      const integrity = await verifyRecordIntegrity(tombstoneRecordId, patientUser);

      expect(integrity.isTombstoned).toBe(true);
      expect(integrity.status).toBe('TOMBSTONED');
      expect(integrity.verified).toBe(false);
      expect(integrity.computedHash).toBe('');

      // Attempting to download tombstoned record must fail closed
      await expect(downloadAndDecryptRecord(tombstoneRecordId, patientUser)).rejects.toThrow(
        /cryptographically shredded/i
      );
    });
  });

  // =========================================================================
  // 8. SERVER-SIDE AUDIT EVIDENCE VERIFICATION & ERROR RESILIENCE
  // =========================================================================
  describe('8. Server-Side Audit Evidence Verification & Error Resilience', () => {
    it('8.1 should return verification failure for non-existent or fake transaction hash', async () => {
      const fakeAuditId = `aud-fake-${Date.now()}`;
      const fakeAudit = {
        id: fakeAuditId,
        patientId: patientUser.id,
        actorId: doctorUser.id,
        actorName: doctorUser.email,
        actorRole: 'DOCTOR' as any,
        recordType: 'General',
        purpose: 'Non-existent Tx Test',
        accessType: 'NORMAL' as any,
        status: 'COMPLETED' as any,
        txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        timestamp: new Date(),
        details: { entityType: 'AUDIT', entityId: fakeAuditId },
      };

      store.auditLogs.unshift(fakeAudit);

      const verification = await verifyAuditEvidence(fakeAuditId, patientUser);
      expect(verification.verified).toBe(false);
      expect(verification.failureReason).toBe('missing transaction');
    });

    it('8.2 should return failure reason when audit log has no transaction hash', async () => {
      const unanchoredAuditId = `aud-unanchored-${Date.now()}`;
      const unanchoredAudit = {
        id: unanchoredAuditId,
        patientId: patientUser.id,
        actorId: doctorUser.id,
        actorName: doctorUser.email,
        actorRole: 'DOCTOR' as any,
        recordType: 'General',
        purpose: 'Unanchored Test',
        accessType: 'NORMAL' as any,
        status: 'COMPLETED' as any,
        timestamp: new Date(),
      };

      store.auditLogs.unshift(unanchoredAudit);

      const verification = await verifyAuditEvidence(unanchoredAuditId, patientUser);
      expect(verification.verified).toBe(false);
      expect(verification.failureReason).toBe('missing transaction');
    });
  });

  // =========================================================================
  // 9. MULTI-TENANT & ROLE-BASED ACCESS CONTROL FOR AUDIT EVIDENCE
  // =========================================================================
  describe('9. Multi-Tenant & Role-Based Access Scoping for Audit Evidence', () => {
    let scopedApolloAuditId: string;

    beforeAll(() => {
      scopedApolloAuditId = `aud-scoped-apollo-${Date.now()}`;
      store.auditLogs.unshift({
        id: scopedApolloAuditId,
        patientId: patientUser.id,
        actorId: doctorUser.id,
        actorName: doctorUser.email,
        actorRole: 'DOCTOR' as any,
        hospital: 'Apollo Medical Center',
        recordType: 'General',
        purpose: 'Multi-Tenant Scoping Test Log',
        accessType: 'NORMAL' as any,
        status: 'COMPLETED' as any,
        timestamp: new Date(),
      });
    });

    it('9.1 should allow patient to access their own audit log', async () => {
      const log = await getAuditLogById(scopedApolloAuditId, patientUser);
      expect(log.id).toBe(scopedApolloAuditId);
      expect(log.patientId).toBe(patientUser.id);
    });

    it('9.2 should deny patient from viewing another patient audit log with 403 Forbidden', async () => {
      await expect(getAuditLogById(scopedApolloAuditId, patient2User)).rejects.toThrow(/access denied/i);
    });

    it('9.3 should restrict Organization Admin to their own facility audit logs', async () => {
      // Admin from Apollo should be able to view Apollo logs
      const log = await getAuditLogById(scopedApolloAuditId, orgAdminUser);
      expect(log.id).toBe(scopedApolloAuditId);

      // Admin from Fortis should be denied access to Apollo log
      const fortisOrgAdmin: AuthenticatedUser = {
        id: 'usr-admin-fortis-01',
        email: 'admin.fortis@medrynx.org',
        role: UserRole.ORGANIZATION_ADMIN,
        hospital: 'Fortis Hospital',
      };

      await expect(getAuditLogById(scopedApolloAuditId, fortisOrgAdmin)).rejects.toThrow(/restricted/i);
    });

    it('9.4 should allow System Administrator to inspect any audit log across tenants', async () => {
      const log = await getAuditLogById(scopedApolloAuditId, systemAdminUser);
      expect(log.id).toBe(scopedApolloAuditId);
    });
  });
});
