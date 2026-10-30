import { describe, it, expect, beforeAll } from 'vitest';
import {
  createAccessRequest,
  getPatientRequests,
  getDoctorRequests,
  rejectAccessRequest,
} from '../services/request.service';
import {
  grantScopedConsent,
  getActiveConsents,
  getAllConsents,
  revokeConsent,
  getConsentBatches,
  approveConsentBatch,
} from '../services/consent.service';
import {
  declareEmergency,
  getEmergencyEvents,
  reconcileEmergencyEvent,
  disputeEmergencyEvent,
  getDisputesList,
} from '../services/emergency.service';
import {
  uploadAndAnchorRecord,
  downloadAndDecryptRecord,
} from '../services/record.service';
import {
  getUserNotifications,
  markNotificationAsRead,
} from '../services/notification.service';
import { prisma, isDbConnected } from '../models/db';
import { store } from '../models/store';
import { AuthenticatedUser } from '../types/common.types';
import { RequestPurpose, RecordCategory, DisputeReason, ConsentStatus, RequestStatus } from '@prisma/client';

describe('MEDRYNX PHASE 8 — CONSENT, SHARING & BREAK-GLASS TEST SUITE', () => {
  const patientBob: AuthenticatedUser = {
    id: 'usr-p8-bob',
    patientId: 'PT-BOB-801',
    email: 'bob.patient@medrynx.org',
    role: 'PATIENT',
    name: 'Bob Patient',
    isVerified: true,
    mfaEnabled: true,
  };

  const patientAlice: AuthenticatedUser = {
    id: 'usr-p8-alice',
    patientId: 'PT-ALICE-802',
    email: 'alice.patient@medrynx.org',
    role: 'PATIENT',
    name: 'Alice Patient',
    isVerified: true,
    mfaEnabled: true,
  };

  const doctorDave: AuthenticatedUser = {
    id: 'usr-p8-doc-dave',
    doctorId: 'DOC-DAVE-801',
    email: 'dave.doctor@hospital.org',
    role: 'DOCTOR',
    name: 'Dr. Dave Cardiologist',
    specialization: 'Cardiology',
    hospital: 'Metro Cardiac Institute',
    isVerified: true,
    mfaEnabled: true,
  };

  const doctorEve: AuthenticatedUser = {
    id: 'usr-p8-doc-eve',
    doctorId: 'DOC-EVE-802',
    email: 'eve.doctor@hospital.org',
    role: 'DOCTOR',
    name: 'Dr. Eve Neurologist',
    specialization: 'Neurology',
    hospital: 'General Hospital',
    isVerified: true,
    mfaEnabled: true,
  };

  let cardioRecordId: string;
  let neuroRecordId: string;
  const cardioPayload = Buffer.from('Electrocardiogram: Normal Sinus Rhythm 72 BPM, PR interval 160ms', 'utf-8');
  const neuroPayload = Buffer.from('Brain MRI Slice: Bilateral hippocampal volume within normal limits', 'utf-8');

  beforeAll(async () => {
    // Register users in store
    store.users.push(patientBob as any);
    store.users.push(patientAlice as any);
    store.users.push(doctorDave as any);
    store.users.push(doctorEve as any);

    // Upload cardio record for patientBob
    const cardioFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'ecg_test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: cardioPayload,
      size: cardioPayload.length,
      destination: '',
      filename: 'ecg_test.pdf',
      path: '',
      stream: null as any,
    };
    const rec1 = await uploadAndAnchorRecord(
      cardioFile,
      {
        title: 'ECG Report Bob',
        category: RecordCategory.Laboratory,
        patientId: patientBob.id,
      },
      patientBob
    );
    cardioRecordId = rec1.id;

    // Upload neuro record for patientBob
    const neuroFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'mri_test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: neuroPayload,
      size: neuroPayload.length,
      destination: '',
      filename: 'mri_test.pdf',
      path: '',
      stream: null as any,
    };
    const rec2 = await uploadAndAnchorRecord(
      neuroFile,
      {
        title: 'Brain MRI Bob',
        category: RecordCategory.Imaging,
        patientId: patientBob.id,
      },
      patientBob
    );
    neuroRecordId = rec2.id;
  });

  // =========================================================================
  // 1. ACCESS REQUEST WORKFLOW & REJECTION
  // =========================================================================
  describe('1. Access Request Lifecycle & Patient Review', () => {
    let createdReqId: string;

    it('1.1 should allow verified clinician to create an access request evaluated by AI Anomaly', async () => {
      const req = await createAccessRequest(
        {
          patientId: patientBob.id,
          recordType: 'Cardiology',
          purpose: RequestPurpose.Diagnosis,
          durationDays: 14,
        },
        doctorDave
      );

      expect(req.id).toBeDefined();
      expect(req.patientId).toBe(patientBob.id);
      expect(req.doctorId).toBe(doctorDave.id);
      expect(req.status).toBe(RequestStatus.PENDING);
      expect(req.durationDays).toBe(14);
      expect(req.anomalyScore).toBeGreaterThanOrEqual(0);
      expect(req.riskLevel).toBeDefined();

      createdReqId = req.id;

      // Verify notification was sent to patient
      const notifs = await getUserNotifications(patientBob.id);
      const consentReqNotif = notifs.find((n) => n.type === 'CONSENT_REQUEST');
      expect(consentReqNotif).toBeDefined();
      expect(consentReqNotif?.title).toContain('New Scoped Access Request');
    });

    it('1.2 should block non-doctors from creating access requests (403)', async () => {
      await expect(
        createAccessRequest(
          {
            patientId: patientBob.id,
            recordType: 'Cardiology',
            purpose: RequestPurpose.Diagnosis,
          },
          patientAlice
        )
      ).rejects.toThrow(/Only verified medical practitioners can request patient records/);
    });

    it('1.3 should allow patient owner to reject an access request', async () => {
      const rejected = await rejectAccessRequest(createdReqId, patientBob);
      expect(rejected.status).toBe(RequestStatus.REJECTED);
      expect(rejected.reviewedAt).toBeDefined();

      // Verify notification sent to doctor
      const docNotifs = await getUserNotifications(doctorDave.id);
      const rejNotif = docNotifs.find((n) => n.type === 'CONSENT_REJECTED');
      expect(rejNotif).toBeDefined();
    });

    it('1.4 should reject doctor attempting to approve or reject their own request (IDOR defense)', async () => {
      const freshReq = await createAccessRequest(
        {
          patientId: patientBob.id,
          recordType: 'Neurology',
          purpose: RequestPurpose.Treatment,
          durationDays: 7,
        },
        doctorEve
      );

      // Doctor Eve attempts to reject request for Bob -> 403
      await expect(
        rejectAccessRequest(freshReq.id, doctorEve)
      ).rejects.toThrow(/Only the patient owner can reject access requests/);

      // Doctor Eve attempts to approve request for Bob -> 403
      await expect(
        grantScopedConsent({ requestId: freshReq.id }, doctorEve)
      ).rejects.toThrow(/Only the patient owner can approve access requests/);
    });
  });

  // =========================================================================
  // 2. SCOPE-BOUND CONSENT GRANT & RECORD ACCESS
  // =========================================================================
  describe('2. Scope-Bound Dynamic Consent Granting', () => {
    let grantedReqId: string;
    let grantId: string;

    it('2.1 should allow patient to approve request and create scope-bound grant on-chain', async () => {
      const req = await createAccessRequest(
        {
          patientId: patientBob.id,
          recordType: RecordCategory.Laboratory,
          purpose: RequestPurpose.Diagnosis,
          durationDays: 7,
        },
        doctorDave
      );
      grantedReqId = req.id;

      const grant = await grantScopedConsent(
        {
          requestId: grantedReqId,
          durationDays: 7,
          scopeNote: 'Authorized for cardiac diagnostics only',
        },
        patientBob
      );

      expect(grant.id).toBeDefined();
      expect(grant.status).toBe(ConsentStatus.ACTIVE);
      expect(grant.patientId).toBe(patientBob.id);
      expect(grant.doctorId).toBe(doctorDave.id);
      expect(grant.recordType).toBe(RecordCategory.Laboratory);
      expect(grant.onChainTxHash).toBeDefined();
      expect(grant.onChainGrantId).toBeDefined();
      grantId = grant.id;

      // Doctor receives notification
      const docNotifs = await getUserNotifications(doctorDave.id);
      const grantNotif = docNotifs.find((n) => n.type === 'CONSENT_GRANTED');
      expect(grantNotif).toBeDefined();
    });

    it('2.2 should permit consented doctor to download and decrypt record within authorized scope', async () => {
      const downloaded = await downloadAndDecryptRecord(cardioRecordId, doctorDave);
      expect(downloaded.decryptedBuffer.equals(cardioPayload)).toBe(true);
    });

    it('2.3 should strictly reject consented doctor attempting to access records OUTSIDE authorized scope (403)', async () => {
      // Doctor Dave has LAB_REPORT grant, attempting to download IMAGING record -> 403
      await expect(
        downloadAndDecryptRecord(neuroRecordId, doctorDave)
      ).rejects.toThrow(/Access denied: No active consent grant or emergency authorization for this record/);
    });

    it('2.4 should strictly reject doctor attempting to access record of patient without any consent (403)', async () => {
      // Doctor Eve has no grant for patient Bob
      await expect(
        downloadAndDecryptRecord(cardioRecordId, doctorEve)
      ).rejects.toThrow(/Access denied: No active consent grant or emergency authorization for this record/);
    });

    afterAll(async () => {
      if (grantId) {
        await revokeConsent(grantId, patientBob);
      }
    });
  });

  // =========================================================================
  // 3. IMMEDIATE CONSENT REVOCATION (NO STALE WINDOW)
  // =========================================================================
  describe('3. Instant Consent Revocation & Zero Stale Window', () => {
    let activeGrantId: string;

    beforeAll(async () => {
      const grant = await grantScopedConsent(
        {
          patientId: patientBob.id,
          doctorId: doctorDave.id,
          recordType: RecordCategory.Laboratory,
          purpose: 'General checkup',
          durationDays: 5,
        },
        patientBob
      );
      activeGrantId = grant.id;
    });

    it('3.1 should allow authorized access while consent is ACTIVE', async () => {
      const downloaded = await downloadAndDecryptRecord(cardioRecordId, doctorDave);
      expect(downloaded.decryptedBuffer.equals(cardioPayload)).toBe(true);
    });

    it('3.2 should immediately block access once patient revokes consent (403)', async () => {
      const revoked = await revokeConsent(activeGrantId, patientBob);
      expect(revoked.status).toBe(ConsentStatus.REVOKED);
      expect(revoked.revokedAt).toBeDefined();

      // Subsequent download attempt by doctor Dave MUST fail immediately (0ms stale window)
      await expect(
        downloadAndDecryptRecord(cardioRecordId, doctorDave)
      ).rejects.toThrow(/Access denied: No active consent grant or emergency authorization for this record/);
    });

    it('3.3 should prevent unauthorized users from revoking someone else\'s consent (IDOR defense)', async () => {
      const freshGrant = await grantScopedConsent(
        {
          patientId: patientBob.id,
          doctorId: doctorDave.id,
          recordType: RecordCategory.Laboratory,
          purpose: 'Followup',
          durationDays: 3,
        },
        patientBob
      );

      // Patient Alice attempts to revoke Bob's grant
      await expect(
        revokeConsent(freshGrant.id, patientAlice)
      ).rejects.toThrow(/Only the patient owner can revoke consent/);
    });

    afterAll(async () => {
      // Clean up grants created in this section
      for (const g of store.grants.filter(g => g.patientId === patientBob.id && g.status === ConsentStatus.ACTIVE)) {
        await revokeConsent(g.id, patientBob);
      }
    });
  });

  // =========================================================================
  // 4. AUTOMATIC EXPIRATION ENFORCEMENT
  // =========================================================================
  describe('4. Automatic Consent Expiration Enforcement', () => {
    it('4.1 should automatically reject access when consent expiry timestamp is in the past (403)', async () => {
      // Seed expired grant
      const expiredGrant = {
        id: `grnt-exp-${Date.now()}`,
        patientId: patientBob.id,
        doctorId: doctorDave.id,
        recordType: RecordCategory.Laboratory,
        purpose: 'Diagnosis',
        accessStart: new Date(Date.now() - 86400000 * 2), // 2 days ago
        accessExpiry: new Date(Date.now() - 3600000), // Expired 1 hr ago
        status: ConsentStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      store.grants.push(expiredGrant as any);
      if (isDbConnected) {
        try {
          await prisma.accessGrant.create({ data: expiredGrant as any });
        } catch {
          // ignore
        }
      }

      await expect(
        downloadAndDecryptRecord(cardioRecordId, doctorDave)
      ).rejects.toThrow(/Access denied: No active consent grant or emergency authorization for this record/);
    });
  });

  // =========================================================================
  // 5. TRUST + CONSENT MATRIX VERIFICATION
  // =========================================================================
  describe('5. Trust + Consent Matrix Verification', () => {
    it('5.1 should reject access if Trust Relationship is REVOKED even with an ACTIVE consent grant', async () => {
      // 1. Create active grant
      const activeGrant = {
        id: `grnt-trust-test-${Date.now()}`,
        patientId: patientBob.id,
        doctorId: doctorDave.id,
        recordType: RecordCategory.Laboratory,
        purpose: 'Cardiac checkup',
        accessStart: new Date(),
        accessExpiry: new Date(Date.now() + 3600000),
        status: ConsentStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.grants.push(activeGrant as any);

      // 2. Establish REVOKED trust relationship
      store.relationships.push({
        id: `rel-revoked-${Date.now()}`,
        type: 'PATIENT_PROVIDER',
        subjectId: patientBob.id,
        targetUserId: doctorDave.id,
        status: 'REVOKED',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      if (isDbConnected) {
        try {
          await (prisma as any).trustRelationship.create({
            data: {
              id: `rel-revoked-${Date.now()}`,
              relationshipType: 'PATIENT_PROVIDER',
              subjectId: patientBob.id,
              targetUserId: doctorDave.id,
              status: 'REVOKED',
            },
          });
        } catch {
          // ignore
        }
      }

      // Must be DENIED with ABAC revoked trust error
      await expect(
        downloadAndDecryptRecord(cardioRecordId, doctorDave)
      ).rejects.toThrow(/Trust relationship between patient and provider has been revoked/);

      // Clean up revoked relationship so it doesn't affect subsequent tests
      store.relationships = store.relationships.filter((r) => r.status !== 'REVOKED');
      if (isDbConnected) {
        try {
          await (prisma as any).trustRelationship.deleteMany({
            where: { subjectId: patientBob.id, targetUserId: doctorDave.id },
          });
        } catch {
          // ignore
        }
      }
    });

    it('5.2 should verify that active trust alone without consent CANNOT access records (DENY)', async () => {
      // Create ACTIVE trust relationship between Bob and Eve
      store.relationships.push({
        id: `rel-active-${Date.now()}`,
        type: 'PATIENT_PROVIDER',
        subjectId: patientBob.id,
        targetUserId: doctorEve.id,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Doctor Eve has NO consent grant for Bob -> 403 Forbidden!
      await expect(
        downloadAndDecryptRecord(neuroRecordId, doctorEve)
      ).rejects.toThrow(/Access denied: No active consent grant or emergency authorization for this record/);
    });
  });

  // =========================================================================
  // 6. CARE TEAM BATCH CONSENTING
  // =========================================================================
  describe('6. Care Team Grouped Consent Batching', () => {
    it('6.1 should approve care team batch and mint individual grants on-chain', async () => {
      const batches = await getConsentBatches(patientBob.id);
      expect(batches.length).toBeGreaterThan(0);
      const targetBatch = batches[0];

      const result = await approveConsentBatch(targetBatch.id, patientBob);
      expect(result.batch.status).toBe('APPROVED');
      expect(result.grants.length).toBeGreaterThanOrEqual(1);

      // Verify each clinician in the care team now has an active individual grant
      for (const grant of result.grants) {
        expect(grant.status).toBe(ConsentStatus.ACTIVE);
        expect(grant.onChainTxHash).toBeDefined();
        expect(grant.onChainGrantId).toBeDefined();
      }
    });

    it('6.2 should reject auto-approving high-risk flagged consent batches (HTTP 400)', async () => {
      const highRiskBatch = {
        id: `batch-high-risk-${Date.now()}`,
        patientId: patientBob.id,
        title: 'High Risk Urgent Surgery Team',
        recordType: 'Surgery & Anesthesia',
        purpose: 'Urgent Care',
        durationDays: 3,
        riskLevel: 'HIGH',
        status: 'PENDING',
        doctors: [{ id: doctorDave.id, name: 'Dr. Dave', specialty: 'Cardio', hospital: 'ABC' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.batches.push(highRiskBatch as any);

      await expect(
        approveConsentBatch(highRiskBatch.id, patientBob)
      ).rejects.toThrow(/High-risk flagged consent batch cannot be batch-approved/);
    });
  });

  // =========================================================================
  // 7. BREAK-GLASS EMERGENCY OVERRIDE & RECONCILIATION
  // =========================================================================
  describe('7. Break-Glass Emergency Access & Disputes', () => {
    let emergencyEventId: string;

    it('7.1 should allow clinician to trigger Tier 1 Partial Emergency access with valid justification', async () => {
      const emg = await declareEmergency(
        {
          patientId: patientBob.id,
          tier: 'PARTIAL',
          reason: 'Severe acute anaphylactic shock in ER, uncommunicative patient',
        },
        doctorDave
      );

      expect(emg.id).toBeDefined();
      expect(emg.verificationTier).toBe('PARTIAL');
      expect(emg.durationMinutes).toBe(15);
      expect(new Date(emg.autoRevokeTimestamp).getTime()).toBeGreaterThan(Date.now());
      expect(emg.onChainTxHash).toBeDefined();
      emergencyEventId = emg.id;

      // Verify patient received urgent alert notification
      const notifs = await getUserNotifications(patientBob.id);
      const emgNotif = notifs.find((n) => n.type === 'EMERGENCY_ACCESS');
      expect(emgNotif).toBeDefined();
    });

    it('7.2 should allow clinician to declare Tier 2 Full Emergency access with emergency code', async () => {
      const fullEmg = await declareEmergency(
        {
          patientId: patientBob.id,
          tier: 'FULL',
          reason: 'Massive myocardial infarction requiring emergency cardiac catheterization',
          emergencyCode: 'EMG-CODE-VERIFIED-CAT-LAB',
        },
        doctorDave
      );

      expect(fullEmg.verificationTier).toBe('FULL');
      expect(fullEmg.durationMinutes).toBe(30);
    });

    it('7.3 should reject Tier 2 Full Emergency override if emergency code is missing (400)', async () => {
      await expect(
        declareEmergency(
          {
            patientId: patientBob.id,
            tier: 'FULL',
            reason: 'Emergency surgery required',
            emergencyCode: '',
          },
          doctorDave
        )
      ).rejects.toThrow(/Declared emergency code is strictly required for Tier 2 Full Access/);
    });

    it('7.4 should reject emergency declaration if clinical justification is empty or too short (400)', async () => {
      await expect(
        declareEmergency(
          {
            patientId: patientBob.id,
            tier: 'PARTIAL',
            reason: '   ',
          },
          doctorDave
        )
      ).rejects.toThrow(/Clinical justification \/ reason is strictly required/);
    });

    it('7.5 should reject non-doctor from declaring emergency break-glass (403)', async () => {
      await expect(
        declareEmergency(
          {
            patientId: patientBob.id,
            tier: 'PARTIAL',
            reason: 'Patient self-reported critical emergency',
          },
          patientAlice
        )
      ).rejects.toThrow(/Only authorized clinical doctors can trigger emergency break-glass/);
    });

    it('7.6 should permit patient to acknowledge and reconcile emergency event', async () => {
      const reconciled = await reconcileEmergencyEvent(emergencyEventId, patientBob);
      expect(reconciled.reconciliationStatus).toBe('ACKNOWLEDGED');
    });

    it('7.7 should permit patient to file an on-chain dispute against contested emergency access', async () => {
      // Create another emergency event to dispute
      const freshEmg = await declareEmergency(
        {
          patientId: patientBob.id,
          tier: 'PARTIAL',
          reason: 'Suspected trauma assessment',
        },
        doctorDave
      );

      const dispute = await disputeEmergencyEvent(
        {
          emergencyEventId: freshEmg.id,
          reason: DisputeReason.Unauthorized_access,
          details: 'I was never admitted to this hospital facility on this date.',
        },
        patientBob
      );

      expect(dispute.id).toBeDefined();
      expect(dispute.status).toBe('OPEN');
      expect(dispute.onChainTxHash).toBeDefined();

      const disputesList = await getDisputesList(patientBob.id);
      expect(disputesList.some((d) => d.emergencyEventId === freshEmg.id)).toBe(true);
    });
  });

  // =========================================================================
  // 8. NOTIFICATION MANAGEMENT & READ LIFECYCLE
  // =========================================================================
  describe('8. Notification Management Lifecycle', () => {
    it('8.1 should allow user to fetch notifications and mark as read', async () => {
      const notifs = await getUserNotifications(patientBob.id);
      expect(notifs.length).toBeGreaterThan(0);

      const targetNotif = notifs[0];
      const success = await markNotificationAsRead(targetNotif.id, patientBob.id);
      expect(success).toBe(true);
    });
  });
});
