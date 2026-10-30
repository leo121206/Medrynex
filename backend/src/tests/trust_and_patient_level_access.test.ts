import { describe, it, expect, beforeAll } from 'vitest';
import {
  createTrustRelationship,
  acceptTrustRelationship,
  rejectTrustRelationship,
  revokeTrustRelationship,
  transitionTrustRelationshipTier,
  evaluatePatientDoctorTrust,
  getDoctorPatientDirectory,
} from '../services/relationship.service';
import {
  createAccessRequest,
  getPatientRequests,
  getDoctorRequests,
} from '../services/request.service';
import {
  grantScopedConsent,
  getActiveConsents,
  revokeConsent,
} from '../services/consent.service';
import {
  uploadAndAnchorRecord,
  getRecordsList,
  downloadAndDecryptRecord,
} from '../services/record.service';
import { declareEmergency } from '../services/emergency.service';
import { store } from '../models/store';
import { AuthenticatedUser } from '../types/common.types';
import {
  UserRole,
  RelationshipType,
  RelationshipStatus,
  RequestPurpose,
  RecordCategory,
  ConsentStatus,
  RequestStatus,
} from '@prisma/client';

describe('MEDRYNX T0–T3 TRUST HIERARCHY & CONSOLIDATED PATIENT-LEVEL ACCESS SUITE', () => {
  const suffix = Date.now().toString().slice(-5);

  const patientPrimary: AuthenticatedUser = {
    id: `usr-t0t3-pt-primary-${suffix}`,
    patientId: `PT-T0T3-${suffix}`,
    email: `patient.primary.${suffix}@medrynx.org`,
    role: UserRole.PATIENT,
    name: 'Aarav Mehta',
    isVerified: true,
    mfaEnabled: true,
  };

  const patientOther: AuthenticatedUser = {
    id: `usr-t0t3-pt-other-${suffix}`,
    patientId: `PT-OTHER-${suffix}`,
    email: `patient.other.${suffix}@medrynx.org`,
    role: UserRole.PATIENT,
    name: 'Meera Nair',
    isVerified: true,
    mfaEnabled: true,
  };

  const doctorPrimary: AuthenticatedUser = {
    id: `usr-t0t3-doc-primary-${suffix}`,
    doctorId: `DOC-T0T3-${suffix}`,
    email: `dr.vikram.${suffix}@hospital.org`,
    role: UserRole.DOCTOR,
    name: 'Dr. Vikram Sethi',
    specialization: 'Cardiology',
    hospital: 'Medrynx Heart Institute',
    isVerified: true,
    mfaEnabled: true,
  };

  const doctorUnrelated: AuthenticatedUser = {
    id: `usr-t0t3-doc-unrelated-${suffix}`,
    doctorId: `DOC-UNREL-${suffix}`,
    email: `dr.unrel.${suffix}@hospital.org`,
    role: UserRole.DOCTOR,
    name: 'Dr. Kabir Verma',
    specialization: 'Neurology',
    hospital: 'City Neuro Center',
    isVerified: true,
    mfaEnabled: true,
  };

  let labRecord1Id: string;
  let labRecord2Id: string;
  let cardioRecordId: string;
  let imagingRecordId: string;
  let otherPatientRecordId: string;

  const lab1Payload = Buffer.from('LAB REPORT 1: HbA1c 5.4%, Fasting Glucose 88 mg/dL', 'utf-8');
  const lab2Payload = Buffer.from('LAB REPORT 2: Lipid Profile — LDL 92 mg/dL, HDL 58 mg/dL', 'utf-8');
  const cardioPayload = Buffer.from('CARDIOLOGY: 12-Lead ECG Normal Sinus Rhythm, LVEF 62%', 'utf-8');
  const imagingPayload = Buffer.from('IMAGING: High-Resolution Chest CT — Clear lung fields', 'utf-8');
  const otherPayload = Buffer.from('OTHER PATIENT RECORD: Confidential clinical summary', 'utf-8');

  const makeMockFile = (buf: Buffer, name: string): Express.Multer.File => ({
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: 'application/pdf',
    buffer: buf,
    size: buf.length,
    destination: '',
    filename: name,
    path: '',
    stream: null as any,
  });

  beforeAll(async () => {
    store.users.push(
      { ...patientPrimary, createdAt: new Date(), updatedAt: new Date() } as any,
      { ...patientOther, createdAt: new Date(), updatedAt: new Date() } as any,
      { ...doctorPrimary, createdAt: new Date(), updatedAt: new Date() } as any,
      { ...doctorUnrelated, createdAt: new Date(), updatedAt: new Date() } as any
    );

    // Upload 4 records for patientPrimary across 3 categories (2 Laboratory, 1 Cardiology, 1 Imaging)
    const r1 = await uploadAndAnchorRecord(
      makeMockFile(lab1Payload, 'hba1c_panel.pdf'),
      { title: 'HbA1c & Metabolic Panel', category: RecordCategory.Laboratory, patientId: patientPrimary.id },
      patientPrimary
    );
    labRecord1Id = r1.id;

    const r2 = await uploadAndAnchorRecord(
      makeMockFile(lab2Payload, 'lipid_profile.pdf'),
      { title: 'Comprehensive Lipid Profile', category: RecordCategory.Laboratory, patientId: patientPrimary.id },
      patientPrimary
    );
    labRecord2Id = r2.id;

    const r3 = await uploadAndAnchorRecord(
      makeMockFile(cardioPayload, 'ecg_report.pdf'),
      { title: '12-Lead Electrocardiogram', category: RecordCategory.Cardiology, patientId: patientPrimary.id },
      patientPrimary
    );
    cardioRecordId = r3.id;

    const r4 = await uploadAndAnchorRecord(
      makeMockFile(imagingPayload, 'chest_ct.pdf'),
      { title: 'Chest CT Scan', category: RecordCategory.Imaging, patientId: patientPrimary.id },
      patientPrimary
    );
    imagingRecordId = r4.id;

    // Upload 1 record for patientOther
    const r5 = await uploadAndAnchorRecord(
      makeMockFile(otherPayload, 'other_patient.pdf'),
      { title: 'Other Patient Lab', category: RecordCategory.Laboratory, patientId: patientOther.id },
      patientOther
    );
    otherPatientRecordId = r5.id;
  });

  // =========================================================================
  // 1. T0 — UNKNOWN / UNVERIFIED ENFORCEMENT
  // =========================================================================
  describe('1. T0 (Unknown / Unverified) Restrictions', () => {
    it('1.1 should evaluate initial trust between patient and unknown doctor as T0', async () => {
      const trust = await evaluatePatientDoctorTrust(patientPrimary.id, doctorPrimary.id);
      expect(trust.trustTier).toBe('T0');
      expect(trust.relationshipStatus).toBe('NONE');
      expect(trust.canRequestPatientAccess).toBe(false);
      expect(trust.canViewProtectedRecords).toBe(false);
    });

    it('1.2 should block T0 doctor (no relationship) from submitting a patient-level access request (403)', async () => {
      await expect(
        createAccessRequest(
          {
            patientId: patientPrimary.id,
            categories: ['Laboratory', 'Cardiology'],
            purpose: RequestPurpose.Diagnosis,
            durationDays: 7,
            enforceTrustHierarchy: true,
          },
          doctorPrimary
        )
      ).rejects.toThrow(/T0 Trust Restriction/);
    });

    it('1.3 should block T0 doctor from viewing or decrypting any patient records (403 & empty list)', async () => {
      const visibleRecords = await getRecordsList(doctorPrimary, { patientId: patientPrimary.id });
      expect(visibleRecords.length).toBe(0);

      await expect(
        downloadAndDecryptRecord(labRecord1Id, doctorPrimary)
      ).rejects.toThrow(/Access denied/);
    });
  });

  // =========================================================================
  // 2. T0 -> T1 RELATIONSHIP ESTABLISHMENT & T1 RESTRICTIONS
  // =========================================================================
  describe('2. T0 -> T1 Verified Relationship Establishment', () => {
    let relationshipId: string;

    it('2.1 should keep doctor at T0 while relationship request is PENDING and block access requests', async () => {
      const rel = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: patientPrimary.id,
          notes: 'Outpatient cardiology consultation',
        },
        doctorPrimary
      );

      expect(rel.status).toBe(RelationshipStatus.PENDING);
      expect(rel.trustTier).toBe('T0');
      relationshipId = rel.id;

      // Still PENDING (T0) -> cannot request record access yet!
      await expect(
        createAccessRequest(
          {
            patientId: patientPrimary.id,
            categories: ['Laboratory'],
            purpose: RequestPurpose.Diagnosis,
            enforceTrustHierarchy: true,
          },
          doctorPrimary
        )
      ).rejects.toThrow(/T0 Trust Restriction.*PENDING/);
    });

    it('2.2 should reject invalid jump from PENDING (T0) directly to PATIENT_CARE_TEAM (T3)', async () => {
      await expect(
        transitionTrustRelationshipTier(
          relationshipId,
          RelationshipType.PATIENT_CARE_TEAM,
          patientPrimary
        )
      ).rejects.toThrow(/Invalid trust tier transition/);
    });

    it('2.3 should transition to T1 (Verified Relationship) when patient accepts relationship', async () => {
      const accepted = await acceptTrustRelationship(relationshipId, patientPrimary);
      expect(accepted.status).toBe(RelationshipStatus.ACTIVE);
      expect(accepted.trustTier).toBe('T1');

      const trust = await evaluatePatientDoctorTrust(patientPrimary.id, doctorPrimary.id);
      expect(trust.trustTier).toBe('T1');
      expect(trust.canRequestPatientAccess).toBe(true);
      expect(trust.canViewProtectedRecords).toBe(false);
    });

    it('2.4 should confirm T1 alone still CANNOT view or decrypt any medical records without patient consent', async () => {
      const visible = await getRecordsList(doctorPrimary, { patientId: patientPrimary.id });
      expect(visible.length).toBe(0);

      await expect(
        downloadAndDecryptRecord(labRecord1Id, doctorPrimary)
      ).rejects.toThrow(/Access denied: No active consent grant/);
    });

    it('2.5 should expose only non-sensitive category counts in Doctor Patient Directory at T1', async () => {
      const directory = await getDoctorPatientDirectory(doctorPrimary);
      const entry = directory.find((p) => p.id === patientPrimary.id);
      expect(entry).toBeDefined();
      expect(entry?.trustTier).toBe('T1');
      expect(entry?.canRequestPatientAccess).toBe(true);
      expect(entry?.availableCategories).toEqual(
        expect.arrayContaining(['Laboratory', 'Cardiology', 'Imaging'])
      );
      expect(entry?.totalRecordsCount).toBe(4);
    });
  });

  // =========================================================================
  // 3. CONSOLIDATED PATIENT-LEVEL REQUEST & SCOPE-RESTRICTED APPROVAL (T1 -> T2)
  // =========================================================================
  describe('3. Consolidated Patient-Level Access Request & Scope-Restricted Approval (T1 -> T2)', () => {
    let consolidatedRequestId: string;
    let activeGrantId: string;

    it('3.1 should allow T1 doctor to submit ONE consolidated patient-level request covering multiple categories', async () => {
      const req = await createAccessRequest(
        {
          patientId: patientPrimary.id,
          categories: ['Laboratory', 'Cardiology', 'Imaging'],
          purpose: RequestPurpose.Diagnosis,
          durationDays: 14,
          enforceTrustHierarchy: true,
        },
        doctorPrimary
      );

      expect(req.id).toBeDefined();
      expect(req.status).toBe(RequestStatus.PENDING);
      expect(req.recordType).toBe('Laboratory, Cardiology, Imaging');
      expect((req as any).categories).toEqual(['Laboratory', 'Cardiology', 'Imaging']);
      consolidatedRequestId = req.id;
    });

    it('3.2 should reject duplicate pending patient-level request for the same patient and scope (409)', async () => {
      await expect(
        createAccessRequest(
          {
            patientId: patientPrimary.id,
            categories: ['Laboratory', 'Cardiology', 'Imaging'],
            purpose: RequestPurpose.Diagnosis,
            durationDays: 14,
            enforceTrustHierarchy: true,
          },
          doctorPrimary
        )
      ).rejects.toThrow(/pending patient-level access request for this scope already exists/);
    });

    it('3.3 should allow patient to restrict categories when approving the consolidated request (T1 -> T2)', async () => {
      // Doctor requested Laboratory, Cardiology, Imaging; Patient approves ONLY Laboratory & Cardiology for 7 days
      const grant = await grantScopedConsent(
        {
          requestId: consolidatedRequestId,
          categories: ['Laboratory', 'Cardiology'],
          durationDays: 7,
          scopeNote: 'Approved for Laboratory and Cardiology records only; Imaging excluded.',
        },
        patientPrimary
      );

      expect(grant.id).toBeDefined();
      expect(grant.status).toBe(ConsentStatus.ACTIVE);
      expect(grant.recordType).toBe('Laboratory, Cardiology');
      expect((grant as any).categories).toEqual(['Laboratory', 'Cardiology']);
      expect((grant as any).trustTier).toBe('T2');
      activeGrantId = grant.id;

      const trust = await evaluatePatientDoctorTrust(patientPrimary.id, doctorPrimary.id);
      expect(trust.trustTier).toBe('T2');
      expect(trust.canViewProtectedRecords).toBe(true);
      expect(trust.authorizedCategories).toEqual(['Laboratory', 'Cardiology']);
    });

    it('3.4 should unlock ALL patient documents within the approved categories via the single grant without per-document requests', async () => {
      // Doctor lists records for patientPrimary -> gets 3 records (2 Laboratory + 1 Cardiology), NOT Imaging!
      const visibleRecords = await getRecordsList(doctorPrimary, { patientId: patientPrimary.id });
      expect(visibleRecords.length).toBe(3);
      const visibleIds = visibleRecords.map((r) => r.id);
      expect(visibleIds).toContain(labRecord1Id);
      expect(visibleIds).toContain(labRecord2Id);
      expect(visibleIds).toContain(cardioRecordId);
      expect(visibleIds).not.toContain(imagingRecordId);

      // Doctor decrypts both Laboratory documents and the Cardiology document using the single patient-level grant
      const decLab1 = await downloadAndDecryptRecord(labRecord1Id, doctorPrimary);
      expect(decLab1.decryptedBuffer.equals(lab1Payload)).toBe(true);

      const decLab2 = await downloadAndDecryptRecord(labRecord2Id, doctorPrimary);
      expect(decLab2.decryptedBuffer.equals(lab2Payload)).toBe(true);

      const decCardio = await downloadAndDecryptRecord(cardioRecordId, doctorPrimary);
      expect(decCardio.decryptedBuffer.equals(cardioPayload)).toBe(true);
    });

    it('3.5 should automatically cover newly uploaded documents in approved categories under the active patient-level grant', async () => {
      const newLabPayload = Buffer.from('LAB REPORT 3: Troponin-I < 0.01 ng/mL (Normal)', 'utf-8');
      const newLabRec = await uploadAndAnchorRecord(
        makeMockFile(newLabPayload, 'troponin_lab.pdf'),
        { title: 'High-Sensitivity Troponin Panel', category: RecordCategory.Laboratory, patientId: patientPrimary.id },
        patientPrimary
      );

      const decNewLab = await downloadAndDecryptRecord(newLabRec.id, doctorPrimary);
      expect(decNewLab.decryptedBuffer.equals(newLabPayload)).toBe(true);
    });

    it('3.6 should strictly block access to excluded categories (Imaging) and other patients (403)', async () => {
      // Imaging was unchecked by the patient during consent review -> 403 Forbidden
      await expect(
        downloadAndDecryptRecord(imagingRecordId, doctorPrimary)
      ).rejects.toThrow(/Access denied: No active consent grant/);

      // Other patient's Laboratory record -> 403 Forbidden
      await expect(
        downloadAndDecryptRecord(otherPatientRecordId, doctorPrimary)
      ).rejects.toThrow(/Access denied: No active consent grant/);

      // Unrelated doctor -> 403 Forbidden
      await expect(
        downloadAndDecryptRecord(labRecord1Id, doctorUnrelated)
      ).rejects.toThrow(/Access denied: No active consent grant/);
    });
  });

  // =========================================================================
  // 4. T2 -> T3 CARE TEAM CONTINUITY TRANSITION & BREAK-GLASS SEPARATION
  // =========================================================================
  describe('4. T2 -> T3 Care Team Transition & Break-Glass Separation', () => {
    it('4.1 should allow patient to transition active relationship to PATIENT_CARE_TEAM (T3)', async () => {
      const trustBefore = await evaluatePatientDoctorTrust(patientPrimary.id, doctorPrimary.id);
      expect(trustBefore.relationshipId).toBeDefined();

      const transitioned = await transitionTrustRelationshipTier(
        trustBefore.relationshipId!,
        RelationshipType.PATIENT_CARE_TEAM,
        patientPrimary
      );
      expect(transitioned.relationshipType).toBe(RelationshipType.PATIENT_CARE_TEAM);

      const trustAfter = await evaluatePatientDoctorTrust(patientPrimary.id, doctorPrimary.id);
      expect(trustAfter.trustTier).toBe('T3');
      expect(trustAfter.tierLabel).toContain('T3 — Trusted Care Team');
    });

    it('4.2 should ensure Break-Glass emergency access does NOT permanently upgrade a T0 doctor to T1/T2/T3', async () => {
      // doctorUnrelated is at T0 with patientPrimary
      const beforeEmg = await evaluatePatientDoctorTrust(patientPrimary.id, doctorUnrelated.id);
      expect(beforeEmg.trustTier).toBe('T0');

      const emg = await declareEmergency(
        {
          patientId: patientPrimary.id,
          tier: 'PARTIAL',
          reason: 'Emergency trauma stabilization in ER bay 4',
        },
        doctorUnrelated
      );
      expect(emg.durationMinutes).toBe(15);

      // Trust tier must still be T0 — Break-Glass is a temporary emergency override, NOT a trust upgrade
      const afterEmg = await evaluatePatientDoctorTrust(patientPrimary.id, doctorUnrelated.id);
      expect(afterEmg.trustTier).toBe('T0');
    });
  });

  // =========================================================================
  // 5. INSTANT CONSENT REVOCATION & TRUST REVOCATION CASCADE
  // =========================================================================
  describe('5. Instant Consent Revocation (T3 -> T1) & Trust Revocation Cascade (T1 -> T0)', () => {
    it('5.1 should downgrade doctor from T3 to T1 and block record access immediately when consent is revoked', async () => {
      const activeConsents = await getActiveConsents(patientPrimary.id, doctorPrimary.id);
      expect(activeConsents.length).toBeGreaterThan(0);

      for (const g of activeConsents) {
        await revokeConsent(g.id, patientPrimary);
      }

      const trustAfterConsentRevoke = await evaluatePatientDoctorTrust(patientPrimary.id, doctorPrimary.id);
      expect(trustAfterConsentRevoke.trustTier).toBe('T1');
      expect(trustAfterConsentRevoke.canViewProtectedRecords).toBe(false);

      // Immediate 0ms block on record download and record listing
      const visible = await getRecordsList(doctorPrimary, { patientId: patientPrimary.id });
      expect(visible.length).toBe(0);

      await expect(
        downloadAndDecryptRecord(labRecord1Id, doctorPrimary)
      ).rejects.toThrow(/Access denied: No active consent grant/);
    });

    it('5.2 should downgrade doctor to T0 and cascade-revoke any active grants when trust relationship is revoked', async () => {
      // Grant a fresh consent first
      const tempGrant = await grantScopedConsent(
        {
          patientId: patientPrimary.id,
          doctorId: doctorPrimary.id,
          categories: ['Laboratory'],
          purpose: 'Follow-up',
          durationDays: 5,
        },
        patientPrimary
      );
      expect(tempGrant.status).toBe(ConsentStatus.ACTIVE);

      const trustCurrent = await evaluatePatientDoctorTrust(patientPrimary.id, doctorPrimary.id);
      expect(trustCurrent.relationshipId).toBeDefined();

      // Revoke the TrustRelationship itself
      const revokedRel = await revokeTrustRelationship(trustCurrent.relationshipId!, patientPrimary);
      expect(revokedRel.status).toBe(RelationshipStatus.REVOKED);
      expect(revokedRel.trustTier).toBe('T0');

      // Verify trust tier is now T0 (REVOKED)
      const trustAfterRelRevoke = await evaluatePatientDoctorTrust(patientPrimary.id, doctorPrimary.id);
      expect(trustAfterRelRevoke.trustTier).toBe('T0');
      expect(trustAfterRelRevoke.relationshipStatus).toBe(RelationshipStatus.REVOKED);
      expect(trustAfterRelRevoke.activeGrantsCount).toBe(0);

      // Verify doctor cannot request access or download records
      await expect(
        createAccessRequest(
          {
            patientId: patientPrimary.id,
            categories: ['Laboratory'],
            purpose: RequestPurpose.Diagnosis,
            enforceTrustHierarchy: true,
          },
          doctorPrimary
        )
      ).rejects.toThrow(/T0 Trust Restriction/);

      await expect(
        downloadAndDecryptRecord(labRecord1Id, doctorPrimary)
      ).rejects.toThrow(/Trust relationship between patient and provider has been revoked|Access denied/);
    });
  });
});
