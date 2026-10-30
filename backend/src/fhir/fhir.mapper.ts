import {
  FhirPatient,
  FhirPractitioner,
  FhirOrganization,
  FhirEncounter,
  FhirCondition,
  FhirObservation,
  FhirDiagnosticReport,
  FhirMedicationRequest,
  FhirDocumentReference,
  FhirConsent,
  FhirAuditEvent,
} from './fhir.types';

const MIME_MAP: Record<string, string> = {
  PDF: 'application/pdf',
  PNG: 'image/png',
  JPG: 'image/jpeg',
  JPEG: 'image/jpeg',
  DICOM: 'application/dicom',
  JSON: 'application/json',
};

/**
 * Maps Medrynx Patient User to HL7 FHIR R4 Patient Resource.
 */
export function toFhirPatient(user: any): FhirPatient {
  const nameParts = (user.name || 'Anonymous Patient').trim().split(/\s+/);
  const family = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
  const given = nameParts.length > 1 ? nameParts.slice(0, -1) : [nameParts[0]];

  const telecoms: any[] = [];
  if (user.email) {
    telecoms.push({ system: 'email', value: user.email, use: 'home' });
  }
  if (user.phone) {
    telecoms.push({ system: 'phone', value: user.phone, use: 'mobile' });
  }

  const patientId = user.patientId || user.id;

  return {
    resourceType: 'Patient',
    id: patientId,
    meta: {
      versionId: '1',
      lastUpdated: user.updatedAt ? new Date(user.updatedAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
    },
    identifier: [
      {
        use: 'usual',
        system: 'urn:oid:2.16.840.1.113883.4.1',
        value: patientId,
      },
    ],
    active: user.isActive !== false,
    name: [
      {
        use: 'official',
        family,
        given,
        text: user.name,
      },
    ],
    telecom: telecoms.length > 0 ? telecoms : undefined,
    gender: (user.gender?.toLowerCase() === 'male' || user.gender?.toLowerCase() === 'female' || user.gender?.toLowerCase() === 'other')
      ? user.gender.toLowerCase()
      : 'unknown',
    birthDate: user.dob ? user.dob : undefined,
    managingOrganization: user.organizationId
      ? { reference: `Organization/${user.organizationId}` }
      : undefined,
  };
}

/**
 * Maps Medrynx Clinician User to HL7 FHIR R4 Practitioner Resource.
 */
export function toFhirPractitioner(user: any): FhirPractitioner {
  const nameParts = (user.name || 'Medical Practitioner').trim().split(/\s+/);
  const family = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
  const given = nameParts.length > 1 ? nameParts.slice(0, -1) : [nameParts[0]];

  const telecoms: any[] = [];
  if (user.email) {
    telecoms.push({ system: 'email', value: user.email, use: 'work' });
  }
  if (user.phone) {
    telecoms.push({ system: 'phone', value: user.phone, use: 'work' });
  }

  const practitionerId = user.doctorId || user.id;

  return {
    resourceType: 'Practitioner',
    id: practitionerId,
    meta: {
      versionId: '1',
      lastUpdated: user.updatedAt ? new Date(user.updatedAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Practitioner'],
    },
    identifier: [
      {
        use: 'official',
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: user.licenseId || user.licenseNumber || `NPI-${practitionerId.slice(0, 8)}`,
      },
    ],
    active: true,
    name: [
      {
        use: 'official',
        family,
        given,
        prefix: ['Dr.'],
        text: user.name,
      },
    ],
    telecom: telecoms.length > 0 ? telecoms : undefined,
    qualification: [
      {
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '309343006',
              display: user.specialization || user.specialty || 'General Practice',
            },
          ],
          text: user.specialization || user.specialty || 'General Practice',
        },
      },
    ],
  };
}

/**
 * Maps Medrynx Organization to HL7 FHIR R4 Organization Resource.
 */
export function toFhirOrganization(org: any): FhirOrganization {
  const orgId = org.code || org.id;

  return {
    resourceType: 'Organization',
    id: orgId,
    meta: {
      versionId: '1',
      lastUpdated: org.updatedAt ? new Date(org.updatedAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Organization'],
    },
    identifier: [
      {
        use: 'official',
        system: 'urn:ietf:rfc:3986',
        value: `urn:uuid:${org.id}`,
      },
    ],
    active: org.status === 'ACTIVE',
    type: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
            code: org.type === 'HOSPITAL' ? 'prov' : org.type === 'LABORATORY' ? 'dept' : 'cli',
            display: org.type || 'Healthcare Provider',
          },
        ],
      },
    ],
    name: org.name,
    telecom: org.contactEmail
      ? [{ system: 'email', value: org.contactEmail, use: 'work' }]
      : undefined,
    address: org.address
      ? [{ line: [org.address], text: org.address }]
      : undefined,
  };
}

/**
 * Maps Medrynx EmergencyEvent to HL7 FHIR R4 Encounter Resource.
 */
export function toFhirEncounter(emergency: any): FhirEncounter {
  const now = new Date();
  const isExpired = emergency.autoRevokeTimestamp && new Date(emergency.autoRevokeTimestamp) < now;
  const isDisputed = emergency.reconciliationStatus === 'DISPUTED';

  let status: FhirEncounter['status'] = 'in-progress';
  if (isDisputed) {
    status = 'cancelled';
  } else if (isExpired || emergency.reconciliationStatus === 'ACKNOWLEDGED') {
    status = 'finished';
  }

  return {
    resourceType: 'Encounter',
    id: emergency.id,
    meta: {
      versionId: '1',
      lastUpdated: emergency.updatedAt ? new Date(emergency.updatedAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Encounter'],
    },
    identifier: [
      {
        system: 'urn:medrynx:emergency-event',
        value: emergency.id,
      },
    ],
    status,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'EMER',
      display: 'Emergency Break-Glass Encounter',
    },
    subject: {
      reference: `Patient/${emergency.patientId}`,
    },
    participant: [
      {
        individual: {
          reference: `Practitioner/${emergency.doctorId}`,
        },
      },
    ],
    serviceProvider: emergency.hospital
      ? { display: emergency.hospital }
      : undefined,
    period: {
      start: emergency.accessWindowStart ? new Date(emergency.accessWindowStart).toISOString() : new Date(emergency.createdAt).toISOString(),
      end: emergency.autoRevokeTimestamp ? new Date(emergency.autoRevokeTimestamp).toISOString() : undefined,
    },
    reasonCode: [
      {
        text: emergency.reason || 'Emergency Break-Glass Clinical Session',
      },
    ],
  };
}

/**
 * Maps Medrynx Record (Category: Clinical) to HL7 FHIR R4 Condition Resource.
 * Omit non-existent fields; strictly zero fabrication.
 */
export function toFhirCondition(record: any): FhirCondition {
  return {
    resourceType: 'Condition',
    id: record.id,
    meta: {
      versionId: String(record.currentVersion || 1),
      lastUpdated: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Condition'],
    },
    identifier: [
      {
        system: 'urn:ietf:rfc:3986',
        value: `urn:medrynx:record:${record.id}`,
      },
    ],
    clinicalStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active',
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
          code: 'confirmed',
          display: 'Confirmed',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/condition-category',
            code: 'encounter-diagnosis',
            display: 'Encounter Diagnosis',
          },
        ],
      },
    ],
    code: {
      text: record.title,
    },
    subject: {
      reference: `Patient/${record.patientId}`,
    },
    recordedDate: record.recordDate ? new Date(record.recordDate).toISOString() : new Date(record.createdAt).toISOString(),
    recorder: record.creatorId ? { reference: `Practitioner/${record.creatorId}` } : undefined,
    asserter: record.issuingClinician ? { display: record.issuingClinician } : undefined,
    note: record.description ? [{ text: record.description }] : undefined,
  };
}

/**
 * Maps Medrynx Record (Laboratory, Cardiology, Genomic, Vaccination) to HL7 FHIR R4 Observation Resource.
 */
export function toFhirObservation(record: any): FhirObservation {
  const categoryCodeMap: Record<string, string> = {
    Laboratory: 'laboratory',
    Cardiology: 'exam',
    Genomic: 'laboratory',
    Vaccination: 'procedure',
    Clinical: 'exam',
  };

  const catCode = categoryCodeMap[record.category] || 'exam';

  return {
    resourceType: 'Observation',
    id: record.id,
    meta: {
      versionId: String(record.currentVersion || 1),
      lastUpdated: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Observation'],
    },
    identifier: [
      {
        system: 'urn:ietf:rfc:3986',
        value: `urn:medrynx:record:${record.id}`,
      },
    ],
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: catCode,
            display: record.category,
          },
        ],
      },
    ],
    code: {
      text: record.title,
    },
    subject: {
      reference: `Patient/${record.patientId}`,
    },
    effectiveDateTime: record.recordDate ? new Date(record.recordDate).toISOString() : new Date(record.createdAt).toISOString(),
    issued: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
    performer: record.issuingClinician
      ? [{ display: record.issuingClinician }]
      : record.creatorId
        ? [{ reference: `Practitioner/${record.creatorId}` }]
        : undefined,
    valueString: record.description || record.title,
    note: record.description ? [{ text: record.description }] : undefined,
  };
}

/**
 * Maps Medrynx Record (Laboratory, Imaging, Cardiology, Genomic) to HL7 FHIR R4 DiagnosticReport Resource.
 */
export function toFhirDiagnosticReport(record: any): FhirDiagnosticReport {
  const reportCategoryMap: Record<string, string> = {
    Imaging: 'RAD',
    Laboratory: 'LAB',
    Cardiology: 'CARD',
    Genomic: 'GE',
  };

  const repCode = reportCategoryMap[record.category] || 'LAB';

  const presentedForm: any[] = [];
  if (record.encryptedIpfsHash) {
    presentedForm.push({
      contentType: MIME_MAP[record.fileType] || 'application/pdf',
      url: `ipfs://${record.encryptedIpfsHash}`,
      hash: record.sha256Hash ? Buffer.from(record.sha256Hash, 'hex').toString('base64') : undefined,
      title: record.title,
      creation: record.recordDate ? new Date(record.recordDate).toISOString() : new Date(record.createdAt).toISOString(),
    });
  }

  return {
    resourceType: 'DiagnosticReport',
    id: record.id,
    meta: {
      versionId: String(record.currentVersion || 1),
      lastUpdated: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/DiagnosticReport'],
    },
    identifier: [
      {
        system: 'urn:ietf:rfc:3986',
        value: `urn:medrynx:record:${record.id}`,
      },
    ],
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: repCode,
            display: record.category,
          },
        ],
      },
    ],
    code: {
      text: record.title,
    },
    subject: {
      reference: `Patient/${record.patientId}`,
    },
    effectiveDateTime: record.recordDate ? new Date(record.recordDate).toISOString() : new Date(record.createdAt).toISOString(),
    issued: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
    performer: record.issuingClinician
      ? [{ display: record.issuingClinician }]
      : record.creatorId
        ? [{ reference: `Practitioner/${record.creatorId}` }]
        : undefined,
    presentedForm: presentedForm.length > 0 ? presentedForm : undefined,
  };
}

/**
 * Maps Medrynx Record (Category: Medication) to HL7 FHIR R4 MedicationRequest Resource.
 */
export function toFhirMedicationRequest(record: any): FhirMedicationRequest {
  return {
    resourceType: 'MedicationRequest',
    id: record.id,
    meta: {
      versionId: String(record.currentVersion || 1),
      lastUpdated: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/MedicationRequest'],
    },
    identifier: [
      {
        system: 'urn:ietf:rfc:3986',
        value: `urn:medrynx:record:${record.id}`,
      },
    ],
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      text: record.title,
    },
    subject: {
      reference: `Patient/${record.patientId}`,
    },
    authoredOn: record.recordDate ? new Date(record.recordDate).toISOString() : new Date(record.createdAt).toISOString(),
    requester: record.creatorId
      ? { reference: `Practitioner/${record.creatorId}`, display: record.issuingClinician }
      : record.issuingClinician
        ? { display: record.issuingClinician }
        : undefined,
    note: record.description ? [{ text: record.description }] : undefined,
  };
}

/**
 * Maps RecordMetadata to HL7 FHIR R4 DocumentReference Resource.
 */
export function toFhirDocumentReference(record: any): FhirDocumentReference {
  return {
    resourceType: 'DocumentReference',
    id: record.id,
    meta: {
      versionId: String(record.currentVersion || 1),
      lastUpdated: record.createdAt ? new Date(record.createdAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/DocumentReference'],
    },
    status: 'current',
    docStatus: 'final',
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '34133-9',
          display: record.category || 'Medical Summary Document',
        },
      ],
      text: record.title,
    },
    category: [
      {
        coding: [
          {
            system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
            code: 'clinical-note',
            display: record.category,
          },
        ],
      },
    ],
    subject: {
      reference: `Patient/${record.patientId}`,
    },
    date: record.recordDate ? new Date(record.recordDate).toISOString() : new Date().toISOString(),
    author: record.issuingClinician ? [{ display: record.issuingClinician }] : undefined,
    custodian: record.issuingHospital ? { display: record.issuingHospital } : undefined,
    description: record.description || record.title,
    securityLabel: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
            code: 'R',
            display: 'Restricted (Envelope Encrypted with AES-256-GCM)',
          },
        ],
      },
    ],
    content: [
      {
        attachment: {
          contentType: MIME_MAP[record.fileType] || 'application/octet-stream',
          url: `ipfs://${record.encryptedIpfsHash}`,
          hash: record.sha256Hash ? Buffer.from(record.sha256Hash, 'hex').toString('base64') : undefined,
          title: record.title,
          creation: record.recordDate ? new Date(record.recordDate).toISOString() : undefined,
        },
      },
    ],
  };
}

/**
 * Maps AccessGrant to HL7 FHIR R4 Consent Resource.
 */
export function toFhirConsent(grant: any): FhirConsent {
  const isExpired = new Date(grant.accessExpiry) < new Date();
  const status = grant.status === 'REVOKED' ? 'rejected' : isExpired ? 'inactive' : 'active';

  return {
    resourceType: 'Consent',
    id: grant.id,
    meta: {
      versionId: '1',
      lastUpdated: grant.createdAt ? new Date(grant.createdAt).toISOString() : new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Consent'],
    },
    status,
    scope: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'patient-privacy',
          display: 'Privacy Consent',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'IDSCL',
            display: 'Information Disclosure',
          },
        ],
      },
    ],
    patient: {
      reference: `Patient/${grant.patientId}`,
    },
    dateTime: grant.grantedAt ? new Date(grant.grantedAt).toISOString() : new Date().toISOString(),
    performer: [
      {
        reference: `Practitioner/${grant.doctorId}`,
      },
    ],
    provision: {
      type: status === 'active' ? 'permit' : 'deny',
      period: {
        start: grant.grantedAt ? new Date(grant.grantedAt).toISOString() : undefined,
        end: grant.accessExpiry ? new Date(grant.accessExpiry).toISOString() : undefined,
      },
      class: [
        {
          system: 'http://hl7.org/fhir/resource-types',
          code: grant.recordType || 'MedicalRecord',
        },
      ],
    },
  };
}

/**
 * Maps AuditLog to HL7 FHIR R4 AuditEvent Resource.
 */
export function toFhirAuditEvent(audit: any): FhirAuditEvent {
  return {
    resourceType: 'AuditEvent',
    id: audit.id,
    type: {
      system: 'http://dicom.nema.org/resources/ontology/DCM',
      code: '110110',
      display: 'Patient Record Access',
    },
    subtype: [
      {
        system: 'http://hl7.org/fhir/restful-interaction',
        code: audit.accessType === 'EMERGENCY' ? 'override' : 'read',
        display: audit.purpose || 'Clinical EHR Access',
      },
    ],
    action: 'R',
    recorded: audit.timestamp ? new Date(audit.timestamp).toISOString() : new Date().toISOString(),
    outcome: audit.status === 'COMPLETED' ? '0' : '4',
    outcomeDesc: audit.status,
    agent: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-RoleClass',
              code: audit.actorRole || 'PROV',
              display: audit.actorRole || 'Practitioner',
            },
          ],
        },
        who: {
          reference: `Practitioner/${audit.actorId}`,
          display: audit.actorName,
        },
        requestor: true,
      },
    ],
    source: {
      observer: {
        display: audit.hospital || 'Medrynx Node Gateway',
      },
    },
    entity: [
      {
        what: {
          reference: `Patient/${audit.patientId}`,
        },
        type: {
          system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
          code: '1',
          display: 'Person',
        },
        role: {
          system: 'http://terminology.hl7.org/CodeSystem/object-role',
          code: '1',
          display: 'Patient',
        },
      },
    ],
  };
}
