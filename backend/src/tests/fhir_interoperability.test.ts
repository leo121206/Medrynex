import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { fhirService } from '../services/fhir.service';
import { signToken } from '../utils/jwt';
import {
  validateFhirResource,
  assertValidFhirResource,
  assertValidFhirBundle,
} from '../fhir/fhir.validator';
import {
  toFhirPatient,
  toFhirPractitioner,
  toFhirOrganization,
  toFhirEncounter,
  toFhirCondition,
  toFhirObservation,
  toFhirDiagnosticReport,
  toFhirMedicationRequest,
  toFhirDocumentReference,
} from '../fhir/fhir.mapper';
import { store } from '../models/store';
import { AuthenticatedUser } from '../types/common.types';
import { RecordCategory, RecordFileType, UserRole, StorageStatus, RecordStatus } from '@prisma/client';

describe('MEDRYNX PHASE 10 — HL7 FHIR R4 INTEROPERABILITY SUITE', () => {
  // Actors
  const patientAlice: AuthenticatedUser = {
    id: 'usr-pt-alice-p10',
    email: 'alice.p10@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-ALICE-P10',
    hospital: 'Apollo Medical Center',
  };

  const patientBob: AuthenticatedUser = {
    id: 'usr-pt-bob-p10',
    email: 'bob.p10@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-BOB-P10',
    hospital: 'Apollo Medical Center',
  };

  const doctorDave: AuthenticatedUser = {
    id: 'usr-doc-dave-p10',
    email: 'dr.dave.p10@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-DAVE-P10',
    hospital: 'Apollo Medical Center',
  };

  const doctorEve: AuthenticatedUser = {
    id: 'usr-doc-eve-p10',
    email: 'dr.eve.p10@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-EVE-P10',
    hospital: 'Fortis Hospital',
  };

  const orgAdminApollo: AuthenticatedUser = {
    id: 'usr-admin-apollo-p10',
    email: 'admin.apollo.p10@medrynx.org',
    role: UserRole.ORGANIZATION_ADMIN,
    hospital: 'Apollo Medical Center',
  };

  const orgAdminFortis: AuthenticatedUser = {
    id: 'usr-admin-fortis-p10',
    email: 'admin.fortis.p10@medrynx.org',
    role: UserRole.ORGANIZATION_ADMIN,
    hospital: 'Fortis Hospital',
  };

  const systemAdmin: AuthenticatedUser = {
    id: 'usr-sysadmin-p10',
    email: 'sysadmin.p10@medrynx.org',
    role: UserRole.ADMIN,
  };

  // JWT Tokens
  let aliceToken: string;
  let bobToken: string;
  let daveToken: string;
  let eveToken: string;
  let apolloAdminToken: string;
  let fortisAdminToken: string;
  let sysAdminToken: string;

  // Test Records IDs
  const recLabId = 'rec-lab-alice-p10';
  const recCardioId = 'rec-cardio-alice-p10';
  const recMedId = 'rec-med-alice-p10';
  const recClinicalId = 'rec-clinical-alice-p10';
  const recImagingId = 'rec-imaging-alice-p10';
  const emergencyId = 'em-alice-dave-p10';
  let consentGrantId: string;

  beforeAll(async () => {
    // Generate JWT tokens
    aliceToken = signToken(patientAlice);
    bobToken = signToken(patientBob);
    daveToken = signToken(doctorDave);
    eveToken = signToken(doctorEve);
    apolloAdminToken = signToken(orgAdminApollo);
    fortisAdminToken = signToken(orgAdminFortis);
    sysAdminToken = signToken(systemAdmin);

    // Seed test users in store.users
    const usersToSeed = [
      {
        id: patientAlice.id,
        patientId: patientAlice.patientId!,
        email: patientAlice.email,
        name: 'Alice Smith',
        role: UserRole.PATIENT,
        hospital: patientAlice.hospital,
        dob: '1985-04-12',
        gender: 'female',
      },
      {
        id: patientBob.id,
        patientId: patientBob.patientId!,
        email: patientBob.email,
        name: 'Bob Jones',
        role: UserRole.PATIENT,
        hospital: patientBob.hospital,
        dob: '1990-11-23',
        gender: 'male',
      },
      {
        id: doctorDave.id,
        doctorId: doctorDave.doctorId!,
        email: doctorDave.email,
        name: 'Dr. Dave Watson',
        role: UserRole.DOCTOR,
        hospital: doctorDave.hospital,
        specialization: 'Cardiology',
        licenseId: 'LIC-DAVE-12345',
      },
      {
        id: doctorEve.id,
        doctorId: doctorEve.doctorId!,
        email: doctorEve.email,
        name: 'Dr. Eve Adams',
        role: UserRole.DOCTOR,
        hospital: doctorEve.hospital,
        specialization: 'Neurology',
        licenseId: 'LIC-EVE-67890',
      },
    ];

    for (const u of usersToSeed) {
      if (!store.users.find((su) => su.id === u.id)) {
        store.users.push(u as any);
      }
    }

    // Seed test organization
    if (!store.organizations.find((o) => o.code === 'APOLLO')) {
      store.organizations.push({
        id: 'org-apollo-p10',
        name: 'Apollo Medical Center',
        code: 'APOLLO',
        type: 'HOSPITAL' as any,
        status: 'ACTIVE',
        address: '21 Greams Lane, Chennai',
        contactEmail: 'contact@apollo.org',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    }

    // Seed test records in store.records
    const recordsToSeed = [
      {
        id: recLabId,
        patientId: patientAlice.id,
        title: 'Comprehensive Metabolic Panel (CMP)',
        category: RecordCategory.Laboratory,
        description: 'Complete blood chemistry and renal function test normative values',
        fileType: RecordFileType.PDF,
        fileSize: '1.2 MB',
        encryptedIpfsHash: 'QmTestLabCidAliceP10MetabolicPanelHash1111',
        sha256Hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        recordStatus: RecordStatus.ACTIVE,
        currentVersion: 1,
        issuingClinician: 'Dr. Dave Watson',
        issuingHospital: 'Apollo Medical Center',
        recordDate: new Date('2026-09-01T10:00:00Z'),
        createdAt: new Date('2026-09-01T10:00:00Z'),
        updatedAt: new Date('2026-09-01T10:00:00Z'),
      },
      {
        id: recCardioId,
        patientId: patientAlice.id,
        title: '12-Lead Electrocardiogram (ECG)',
        category: RecordCategory.Cardiology,
        description: 'Normal sinus rhythm with no ST elevation',
        fileType: RecordFileType.PDF,
        fileSize: '2.5 MB',
        encryptedIpfsHash: 'QmTestCardioCidAliceP10SinusRhythmHash2222',
        sha256Hash: 'b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1',
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        recordStatus: RecordStatus.ACTIVE,
        currentVersion: 1,
        issuingClinician: 'Dr. Dave Watson',
        issuingHospital: 'Apollo Medical Center',
        recordDate: new Date('2026-09-05T14:30:00Z'),
        createdAt: new Date('2026-09-05T14:30:00Z'),
        updatedAt: new Date('2026-09-05T14:30:00Z'),
      },
      {
        id: recMedId,
        patientId: patientAlice.id,
        title: 'Atorvastatin 20mg Oral Tablet',
        category: RecordCategory.Medication,
        description: 'Take 1 tablet orally once daily at bedtime for hyperlipidemia',
        fileType: RecordFileType.JSON,
        fileSize: '0.4 MB',
        encryptedIpfsHash: 'QmTestMedCidAliceP10AtorvastatinHash3333',
        sha256Hash: 'c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2',
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        recordStatus: RecordStatus.ACTIVE,
        currentVersion: 1,
        issuingClinician: 'Dr. Dave Watson',
        issuingHospital: 'Apollo Medical Center',
        recordDate: new Date('2026-09-10T09:15:00Z'),
        createdAt: new Date('2026-09-10T09:15:00Z'),
        updatedAt: new Date('2026-09-10T09:15:00Z'),
      },
      {
        id: recClinicalId,
        patientId: patientAlice.id,
        title: 'Essential Hypertension Consultation',
        category: RecordCategory.Clinical,
        description: 'Patient reports well-managed blood pressure on prescribed regimen',
        fileType: RecordFileType.PDF,
        fileSize: '1.8 MB',
        encryptedIpfsHash: 'QmTestClinicalCidAliceP10HypertensionHash4444',
        sha256Hash: 'd4e5f6a1b2c30718293a4b5c6d7e8f90123456789abcdef0123456789abcdef3',
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        recordStatus: RecordStatus.ACTIVE,
        currentVersion: 1,
        issuingClinician: 'Dr. Dave Watson',
        issuingHospital: 'Apollo Medical Center',
        recordDate: new Date('2026-09-12T11:00:00Z'),
        createdAt: new Date('2026-09-12T11:00:00Z'),
        updatedAt: new Date('2026-09-12T11:00:00Z'),
      },
      {
        id: recImagingId,
        patientId: patientAlice.id,
        title: 'Chest Radiograph (X-Ray)',
        category: RecordCategory.Imaging,
        description: 'PA and lateral views demonstrate clear lung fields bilaterally',
        fileType: RecordFileType.DICOM,
        fileSize: '15.4 MB',
        encryptedIpfsHash: 'QmTestImagingCidAliceP10ChestXRayHash5555',
        sha256Hash: 'e5f6a1b2c3d40718293a4b5c6d7e8f90123456789abcdef0123456789abcdef4',
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        recordStatus: RecordStatus.ACTIVE,
        currentVersion: 1,
        issuingClinician: 'Dr. Dave Watson',
        issuingHospital: 'Apollo Medical Center',
        recordDate: new Date('2026-09-15T16:45:00Z'),
        createdAt: new Date('2026-09-15T16:45:00Z'),
        updatedAt: new Date('2026-09-15T16:45:00Z'),
      },
    ];

    for (const r of recordsToSeed) {
      if (!store.records.find((sr) => sr.id === r.id)) {
        store.records.push(r as any);
      }
    }

    // Seed emergency event
    if (!store.emergencies) store.emergencies = [];
    store.emergencies.push({
      id: emergencyId,
      patientId: patientAlice.id,
      doctorId: doctorDave.id,
      hospital: 'Apollo Medical Center',
      verificationTier: 'FULL' as any,
      recordsAccessed: [recLabId, recCardioId],
      durationMinutes: 30,
      reason: 'Acute Hemodynamic Instability with Suspected Myocardial Infarction',
      accessWindowStart: new Date(Date.now() - 60000), // started 1 min ago
      autoRevokeTimestamp: new Date(Date.now() + 1800000), // active for 30m
      reconciliationStatus: 'PENDING' as any,
      hospitalVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    // Seed active scope-bound grant for Laboratory category
    consentGrantId = `grant-lab-alice-dave-${Date.now()}`;
    store.grants.push({
      id: consentGrantId,
      patientId: patientAlice.id,
      doctorId: doctorDave.id,
      recordType: 'Laboratory',
      purpose: 'Clinical Evaluation',
      accessStart: new Date(),
      accessExpiry: new Date(Date.now() + 86400000 * 7), // 7 days
      status: 'ACTIVE' as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  });

  // =========================================================================
  // 1. CAPABILITYSTATEMENT & CONFORMANCE
  // =========================================================================
  describe('1. HL7 FHIR R4 CapabilityStatement & Conformance Metadata', () => {
    it('1.1 should return valid FHIR CapabilityStatement with application/fhir+json header', async () => {
      const res = await request(app).get('/api/v1/fhir/metadata');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/fhir+json');
      expect(res.body.resourceType).toBe('CapabilityStatement');
      expect(res.body.fhirVersion).toBe('4.0.1');
      expect(res.body.status).toBe('active');
      expect(res.body.kind).toBe('instance');
      expect(res.body.software.name).toContain('Medrynx');

      const supportedTypes = res.body.rest[0].resource.map((r: any) => r.type);
      expect(supportedTypes).toContain('Patient');
      expect(supportedTypes).toContain('Practitioner');
      expect(supportedTypes).toContain('Organization');
      expect(supportedTypes).toContain('Encounter');
      expect(supportedTypes).toContain('Condition');
      expect(supportedTypes).toContain('Observation');
      expect(supportedTypes).toContain('DiagnosticReport');
      expect(supportedTypes).toContain('MedicationRequest');
      expect(supportedTypes).toContain('DocumentReference');
      expect(supportedTypes).toContain('Consent');
      expect(supportedTypes).toContain('AuditEvent');
    });
  });

  // =========================================================================
  // 2. DETERMINISTIC RESOURCE MAPPINGS & ZERO-PHI LEAKAGE
  // =========================================================================
  describe('2. Deterministic Resource Mapping & Zero-Secret Invariant', () => {
    it('2.1 should deterministically transform User to FHIR Patient with proper metadata', () => {
      const rawUser = store.users.find((u) => u.id === patientAlice.id)!;
      const patient = toFhirPatient(rawUser);

      expect(patient.resourceType).toBe('Patient');
      expect(patient.id).toBe(patientAlice.patientId);
      expect(patient.active).toBe(true);
      expect(patient.gender).toBe('female');
      expect(patient.birthDate).toBe('1985-04-12');
      expect(patient.name?.[0].family).toBe('Smith');
      expect(patient.name?.[0].given).toContain('Alice');
      expect(patient.telecom?.[0].value).toBe('alice.p10@medrynx.org');
      expect(patient.meta?.profile).toContain('http://hl7.org/fhir/StructureDefinition/Patient');
    });

    it('2.2 should deterministically transform User to FHIR Practitioner with specialization coding', () => {
      const rawDoc = store.users.find((u) => u.id === doctorDave.id)!;
      const doc = toFhirPractitioner(rawDoc);

      expect(doc.resourceType).toBe('Practitioner');
      expect(doc.id).toBe(doctorDave.doctorId);
      expect(doc.active).toBe(true);
      expect(doc.name?.[0].prefix).toContain('Dr.');
      expect(doc.qualification?.[0].code.text).toBe('Cardiology');
      expect(doc.identifier?.[0].value).toBe('LIC-DAVE-12345');
    });

    it('2.3 should deterministically transform Organization to FHIR Organization', () => {
      const rawOrg = store.organizations.find((o) => o.code === 'APOLLO')!;
      const org = toFhirOrganization(rawOrg);

      expect(org.resourceType).toBe('Organization');
      expect(org.id).toBe('APOLLO');
      expect(org.name).toBe('Apollo Medical Center');
      expect(org.type?.[0].coding?.[0].code).toBe('prov');
      expect(org.telecom?.[0].value).toBe('contact@apollo.org');
    });

    it('2.4 should map EmergencyEvent to FHIR Encounter with class EMER', () => {
      const rawEm = store.emergencies.find((e) => e.id === emergencyId)!;
      const encounter = toFhirEncounter(rawEm);

      expect(encounter.resourceType).toBe('Encounter');
      expect(encounter.id).toBe(emergencyId);
      expect(encounter.status).toBe('in-progress');
      expect(encounter.class.code).toBe('EMER');
      expect(encounter.subject?.reference).toBe(`Patient/${patientAlice.id}`);
      expect(encounter.participant?.[0].individual?.reference).toBe(`Practitioner/${doctorDave.id}`);
      expect(encounter.reasonCode?.[0].text).toContain('Myocardial Infarction');
    });

    it('2.5 should map Clinical record to FHIR Condition without fabricating missing clinical data', () => {
      const rawRec = store.records.find((r) => r.id === recClinicalId)!;
      const condition = toFhirCondition(rawRec);

      expect(condition.resourceType).toBe('Condition');
      expect(condition.id).toBe(recClinicalId);
      expect(condition.clinicalStatus?.coding?.[0].code).toBe('active');
      expect(condition.verificationStatus?.coding?.[0].code).toBe('confirmed');
      expect(condition.code?.text).toBe('Essential Hypertension Consultation');
      expect(condition.subject.reference).toBe(`Patient/${patientAlice.id}`);
      expect(condition.asserter).toEqual({ display: 'Dr. Dave Watson' });
      expect(condition.note?.[0].text).toContain('blood pressure');
    });

    it('2.6 should map Laboratory & Cardiology records to FHIR Observation with proper codes', () => {
      const labRec = store.records.find((r) => r.id === recLabId)!;
      const obs = toFhirObservation(labRec);

      expect(obs.resourceType).toBe('Observation');
      expect(obs.id).toBe(recLabId);
      expect(obs.status).toBe('final');
      expect(obs.category?.[0].coding?.[0].code).toBe('laboratory');
      expect(obs.code.text).toBe('Comprehensive Metabolic Panel (CMP)');
      expect(obs.subject?.reference).toBe(`Patient/${patientAlice.id}`);
    });

    it('2.7 should map Imaging records to FHIR DiagnosticReport with IPFS URI and base64 hash', () => {
      const imgRec = store.records.find((r) => r.id === recImagingId)!;
      const diag = toFhirDiagnosticReport(imgRec);

      expect(diag.resourceType).toBe('DiagnosticReport');
      expect(diag.id).toBe(recImagingId);
      expect(diag.status).toBe('final');
      expect(diag.category?.[0].coding?.[0].code).toBe('RAD');
      expect(diag.presentedForm?.[0].url).toBe(`ipfs://${imgRec.encryptedIpfsHash}`);
      expect(diag.presentedForm?.[0].contentType).toBe('application/dicom');
      expect(diag.presentedForm?.[0].hash).toBeDefined();
    });

    it('2.8 should map Medication record to FHIR MedicationRequest with intent order', () => {
      const medRec = store.records.find((r) => r.id === recMedId)!;
      const medReq = toFhirMedicationRequest(medRec);

      expect(medReq.resourceType).toBe('MedicationRequest');
      expect(medReq.id).toBe(recMedId);
      expect(medReq.status).toBe('active');
      expect(medReq.intent).toBe('order');
      expect(medReq.medicationCodeableConcept?.text).toBe('Atorvastatin 20mg Oral Tablet');
      expect(medReq.subject.reference).toBe(`Patient/${patientAlice.id}`);
    });

    it('2.9 should strictly ensure NO internal secrets, keys, or tokens exist in FHIR resources', () => {
      const labRec = {
        ...store.records.find((r) => r.id === recLabId)!,
        wrappedDek: 'SUPER_SECRET_WRAPPED_DEK_BYTES',
        encryptionAlgorithm: 'AES-256-GCM',
        iv: 'RANDOM_IV_HEX',
        authTag: 'RANDOM_AUTH_TAG',
      };

      const docRef = toFhirDocumentReference(labRec);
      const serialized = JSON.stringify(docRef);

      expect(serialized).not.toContain('SUPER_SECRET_WRAPPED_DEK_BYTES');
      expect(serialized).not.toContain('wrappedDek');
      expect(serialized).not.toContain('authTag');
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('privateKey');
    });
  });

  // =========================================================================
  // 3. DETERMINISTIC ID TRACEABILITY & PROVENANCE
  // =========================================================================
  describe('3. Deterministic ID Traceability & Provenance Integration', () => {
    it('3.1 should include source record URI and version tracking in FHIR meta and identifier', () => {
      const rec = store.records.find((r) => r.id === recLabId)!;
      const obs = toFhirObservation(rec);

      expect(obs.identifier?.[0].system).toBe('urn:ietf:rfc:3986');
      expect(obs.identifier?.[0].value).toBe(`urn:medrynx:record:${recLabId}`);
      expect(obs.meta?.versionId).toBe('1');
    });
  });

  // =========================================================================
  // 4. FHIR R4 VALIDATION ENGINE
  // =========================================================================
  describe('4. FHIR R4 Schema & Reference Validation Engine', () => {
    it('4.1 should successfully validate properly formed FHIR resources', () => {
      const rawUser = store.users.find((u) => u.id === patientAlice.id)!;
      const patient = toFhirPatient(rawUser);
      const result = validateFhirResource(patient);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(() => assertValidFhirResource(patient)).not.toThrow();
    });

    it('4.2 should reject resources with path traversal or invalid id characters', () => {
      const badResource = {
        resourceType: 'Patient',
        id: '../malicious/path',
      };

      const result = validateFhirResource(badResource);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid id format') || e.includes('path'))).toBe(true);
      expect(() => assertValidFhirResource(badResource)).toThrow(/Validation Error/);
    });

    it('4.3 should reject unsupported FHIR resource types', () => {
      const unsupported = {
        resourceType: 'UnsupportedResourceCustom',
        id: 'res-01',
      };

      const result = validateFhirResource(unsupported);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unsupported resourceType'))).toBe(true);
    });

    it('4.4 should validate that nested resources in a Bundle are all valid', () => {
      const validBundle = {
        resourceType: 'Bundle',
        id: 'bundle-test',
        type: 'searchset' as const,
        entry: [
          {
            resource: toFhirPatient(store.users.find((u) => u.id === patientAlice.id)!),
          },
        ],
      };

      expect(() => assertValidFhirBundle(validBundle as any)).not.toThrow();
    });
  });

  // =========================================================================
  // 5. PRE-EXPORT AUTHORIZATION GATING & IDOR DEFENSE
  // =========================================================================
  describe('5. Pre-Export Authorization Gating & IDOR Isolation', () => {
    it('5.1 should allow Patient Alice to read her own FHIR Patient resource', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/Patient/${patientAlice.patientId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Patient');
      expect(res.body.id).toBe(patientAlice.patientId);
    });

    it('5.2 should strictly reject Patient Bob from reading Alice FHIR Patient resource (IDOR 403)', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/Patient/${patientAlice.patientId}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/Patients may only access their own/i);
    });

    it('5.3 should reject Doctor Dave without consent or emergency from accessing Alice Patient (403)', async () => {
      // Temporarily clear consent & emergency for test
      const savedGrants = [...store.grants];
      const savedEmergencies = [...store.emergencies];
      store.grants = [];
      store.emergencies = [];

      try {
        const res = await request(app)
          .get(`/api/v1/fhir/Patient/${patientAlice.patientId}`)
          .set('Authorization', `Bearer ${daveToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error?.message).toMatch(/Active consent or emergency break-glass required/i);
      } finally {
        store.grants = savedGrants;
        store.emergencies = savedEmergencies;
      }
    });

    it('5.4 should allow Doctor Dave with active Laboratory consent to read DiagnosticReport', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/DiagnosticReport/${recLabId}`)
        .set('Authorization', `Bearer ${daveToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('DiagnosticReport');
      expect(res.body.id).toBe(recLabId);
      expect(res.body.code.text).toContain('Comprehensive Metabolic Panel');
    });

    it('5.5 should enforce data minimization: Doctor with Laboratory consent cannot read Medication (403)', async () => {
      // Dave has Laboratory consent, not Medication consent
      // Disable emergency to test pure consent boundary
      const savedEmergencies = [...store.emergencies];
      store.emergencies = [];

      try {
        const res = await request(app)
          .get(`/api/v1/fhir/MedicationRequest/${recMedId}`)
          .set('Authorization', `Bearer ${daveToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error?.message).toMatch(/No active consent grant/i);
      } finally {
        store.emergencies = savedEmergencies;
      }
    });

    it('5.6 should reject category mismatch: calling MedicationRequest on a Laboratory record returns 400', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/MedicationRequest/${recLabId}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/is not Medication/i);
    });

    it('5.7 should instantly block Doctor Dave after consent revocation (zero-stale window 403)', async () => {
      // Temporarily disable emergency
      const savedEmergencies = [...store.emergencies];
      store.emergencies = [];

      try {
        // Revoke Dave's grant
        const grant = store.grants.find((g) => g.id === consentGrantId);
        if (grant) grant.status = 'REVOKED' as any;

        const res = await request(app)
          .get(`/api/v1/fhir/DiagnosticReport/${recLabId}`)
          .set('Authorization', `Bearer ${daveToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error?.message).toMatch(/No active consent grant/i);
      } finally {
        // Restore grant and emergencies
        const grant = store.grants.find((g) => g.id === consentGrantId);
        if (grant) grant.status = 'ACTIVE' as any;
        store.emergencies = savedEmergencies;
      }
    });

    it('5.8 should allow access via emergency break-glass during active emergency session', async () => {
      // Dave accessing cardio record via emergency
      const res = await request(app)
        .get(`/api/v1/fhir/Observation/${recCardioId}`)
        .set('Authorization', `Bearer ${daveToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Observation');
      expect(res.body.id).toBe(recCardioId);
    });

    it('5.9 should deny access once emergency window has expired (403)', async () => {
      // Set emergency autoRevokeTimestamp in the past
      const emergency = store.emergencies.find((e) => e.id === emergencyId)!;
      const originalExpiry = emergency.autoRevokeTimestamp;
      emergency.autoRevokeTimestamp = new Date(Date.now() - 1000);

      // Also ensure Dave has no consent for Cardiology
      try {
        const res = await request(app)
          .get(`/api/v1/fhir/Observation/${recCardioId}`)
          .set('Authorization', `Bearer ${daveToken}`);

        expect(res.status).toBe(403);
      } finally {
        emergency.autoRevokeTimestamp = originalExpiry;
      }
    });

    it('5.10 should deny Organization Admin from Fortis accessing Alice from Apollo (cross-tenant 403)', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/Patient/${patientAlice.patientId}`)
        .set('Authorization', `Bearer ${fortisAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.message).toMatch(/restricted to own facility/i);
    });

    it('5.11 should allow System Administrator to access resources across facilities', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/Patient/${patientAlice.patientId}`)
        .set('Authorization', `Bearer ${sysAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Patient');
      expect(res.body.id).toBe(patientAlice.patientId);
    });
  });

  // =========================================================================
  // 6. SAFE PARAMETERIZED SEARCH & SEARCHSET BUNDLES
  // =========================================================================
  describe('6. Safe Parameterized Search & Non-Enumeration Searchsets', () => {
    it('6.1 should return searchset Bundle when querying observations by patient', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/Observation?patient=${patientAlice.id}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Bundle');
      expect(res.body.type).toBe('searchset');
      expect(res.body.total).toBeGreaterThan(0);
      expect(Array.isArray(res.body.entry)).toBe(true);
      expect(res.body.entry[0].resource.resourceType).toBe('Observation');
    });

    it('6.2 should return empty searchset for unauthorized patient without leaking record existence', async () => {
      // Bob queries Alice's observations
      const res = await request(app)
        .get(`/api/v1/fhir/Observation?patient=${patientAlice.id}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Bundle');
      expect(res.body.type).toBe('searchset');
      // Unauthorized records must be silently omitted (total 0)
      expect(res.body.total).toBe(0);
      expect(res.body.entry.length).toBe(0);
    });

    it('6.3 should filter DiagnosticReports by patient', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/DiagnosticReport?patient=${patientAlice.id}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Bundle');
      expect(res.body.type).toBe('searchset');
      expect(res.body.entry.some((e: any) => e.resource.id === recLabId)).toBe(true);
    });

    it('6.4 should filter MedicationRequests by patient', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/MedicationRequest?patient=${patientAlice.id}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Bundle');
      expect(res.body.entry.some((e: any) => e.resource.id === recMedId)).toBe(true);
    });

    it('6.5 should filter Conditions by patient', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/Condition?patient=${patientAlice.id}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Bundle');
      expect(res.body.entry.some((e: any) => e.resource.id === recClinicalId)).toBe(true);
    });
  });

  // =========================================================================
  // 7. FULL FHIR PATIENT EXPORT & ON-CHAIN AUDIT EVIDENCE
  // =========================================================================
  describe('7. Full FHIR Patient Export Collection & On-Chain Anchoring', () => {
    it('7.1 should generate a validated collection Bundle and anchor export evidence on-chain', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/export/patient/${patientAlice.id}`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/fhir+json');
      expect(res.headers['x-medrynx-evidence-hash']).toBeDefined();
      expect(res.body.resourceType).toBe('Bundle');
      expect(res.body.type).toBe('collection');
      expect(res.body.total).toBeGreaterThan(0);

      // Verify that bundle contains Patient and clinical resources
      const entries = res.body.entry.map((e: any) => e.resource.resourceType);
      expect(entries).toContain('Patient');
      expect(entries).toContain('DocumentReference');
      expect(entries).toContain('Condition');
      expect(entries).toContain('Observation');
      expect(entries).toContain('DiagnosticReport');
      expect(entries).toContain('MedicationRequest');

      // Verify audit log exists
      const auditLog = store.auditLogs.find(
        (a) => a.purpose?.includes('FHIR EXPORT on Bundle') && a.patientId === patientAlice.id
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.details?.evidenceHash).toBe(res.headers['x-medrynx-evidence-hash']);
    });

    it('7.2 should support FHIR $everything syntax endpoint for patient bundle export', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/Patient/${patientAlice.id}/$everything`)
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.resourceType).toBe('Bundle');
      expect(res.body.type).toBe('collection');
    });

    it('7.3 should reject full export attempt by unauthorized third party (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/fhir/export/patient/${patientAlice.id}`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 8. ERROR HANDLING & SECURITY DEFENSIVE INVARIANTS
  // =========================================================================
  describe('8. Error Handling, Defenses & Security Invariants', () => {
    it('8.1 should return 404 for non-existent FHIR resource', async () => {
      const res = await request(app)
        .get('/api/v1/fhir/Observation/rec-non-existent-999')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(404);
    });

    it('8.2 should return 400 for path traversal attempt in resource ID', async () => {
      const res = await request(app)
        .get('/api/v1/fhir/Patient/..%2F..%2Fetc%2Fpasswd')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(400);
    });

    it('8.3 should return 401 for unauthenticated request to FHIR resource', async () => {
      const res = await request(app).get(`/api/v1/fhir/Patient/${patientAlice.patientId}`);

      expect(res.status).toBe(401);
    });
  });
});
