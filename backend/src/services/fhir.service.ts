import { prisma, isDbConnected } from '../models/db';
import { store } from '../models/store';
import { ApiError } from '../utils/apiError';
import { AuthenticatedUser } from '../types/common.types';
import { RecordCategory, AuditAccessType, AuditStatus, ActorRole } from '@prisma/client';
import { checkRecordAuthorization } from './record.service';
import { blockchainService } from './blockchain.service';
import { buildCanonicalEvidencePayload, computeCanonicalHash } from '../crypto/canonicalHash';
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
  FhirBundle,
  FhirCapabilityStatement,
} from '../fhir/fhir.types';
import {
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
  toFhirConsent,
  toFhirAuditEvent,
} from '../fhir/fhir.mapper';

export class FhirService {
  /**
   * Generates HL7 FHIR R4 (4.0.1) CapabilityStatement
   */
  public getCapabilityStatement(): FhirCapabilityStatement {
    return {
      resourceType: 'CapabilityStatement',
      id: 'medrynx-fhir-server',
      status: 'active',
      date: new Date().toISOString(),
      publisher: 'Medrynx Healthcare Platform',
      kind: 'instance',
      software: {
        name: 'Medrynx FHIR Interoperability Engine',
        version: '4.0.1',
      },
      implementation: {
        description: 'HL7 FHIR R4 compliant endpoint for decentralized EHR consent, records and audit evidence',
        url: '/api/v1/fhir',
      },
      fhirVersion: '4.0.1',
      format: ['application/json', 'application/fhir+json'],
      rest: [
        {
          mode: 'server',
          resource: [
            {
              type: 'Patient',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: 'identifier', type: 'token', documentation: 'Patient unique identifier' }],
            },
            {
              type: 'Practitioner',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: 'name', type: 'string', documentation: 'Practitioner name' }],
            },
            {
              type: 'Organization',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: 'name', type: 'string', documentation: 'Organization name' }],
            },
            {
              type: 'Encounter',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: 'patient', type: 'reference', documentation: 'Patient reference' }],
            },
            {
              type: 'Condition',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: 'patient', type: 'reference', documentation: 'Patient reference' }],
            },
            {
              type: 'Observation',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [
                { name: 'patient', type: 'reference', documentation: 'Patient reference' },
                { name: 'category', type: 'token', documentation: 'Observation category' },
                { name: 'date', type: 'date', documentation: 'Effective observation date' },
              ],
            },
            {
              type: 'DiagnosticReport',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [
                { name: 'patient', type: 'reference', documentation: 'Patient reference' },
                { name: 'date', type: 'date', documentation: 'Effective report date' },
              ],
            },
            {
              type: 'MedicationRequest',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [
                { name: 'patient', type: 'reference', documentation: 'Patient reference' },
                { name: 'status', type: 'token', documentation: 'Medication request status' },
              ],
            },
            {
              type: 'DocumentReference',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: 'patient', type: 'reference', documentation: 'Patient reference' }],
            },
            {
              type: 'Consent',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: 'patient', type: 'reference', documentation: 'Patient reference' }],
            },
            {
              type: 'AuditEvent',
              interaction: [{ code: 'read' }, { code: 'search-type' }],
              searchParam: [{ name: 'entity', type: 'reference', documentation: 'Audit entity target' }],
            },
          ],
        },
      ],
    };
  }

  // =========================================================================
  // MAPPER DELEGATES (BACKWARDS COMPATIBILITY)
  // =========================================================================

  public toFhirPatient(user: any): FhirPatient {
    return toFhirPatient(user);
  }

  public toFhirPractitioner(user: any): FhirPractitioner {
    return toFhirPractitioner(user);
  }

  public toFhirOrganization(org: any): FhirOrganization {
    return toFhirOrganization(org);
  }

  public toFhirEncounter(emergency: any): FhirEncounter {
    return toFhirEncounter(emergency);
  }

  public toFhirCondition(record: any): FhirCondition {
    return toFhirCondition(record);
  }

  public toFhirObservation(record: any): FhirObservation {
    return toFhirObservation(record);
  }

  public toFhirDiagnosticReport(record: any): FhirDiagnosticReport {
    return toFhirDiagnosticReport(record);
  }

  public toFhirMedicationRequest(record: any): FhirMedicationRequest {
    return toFhirMedicationRequest(record);
  }

  public toFhirDocumentReference(record: any): FhirDocumentReference {
    return toFhirDocumentReference(record);
  }

  public toFhirConsent(grant: any): FhirConsent {
    return toFhirConsent(grant);
  }

  public toFhirAuditEvent(audit: any): FhirAuditEvent {
    return toFhirAuditEvent(audit);
  }

  // =========================================================================
  // AUTHORIZATION HELPERS
  // =========================================================================

  private async authorizePatientAccess(targetPatientId: string, user: AuthenticatedUser): Promise<void> {
    if (user.role === 'ADMIN') return;

    if (user.role === 'PATIENT') {
      const isOwner = user.id === targetPatientId || user.patientId === targetPatientId;
      if (!isOwner) {
        throw ApiError.forbidden('Access denied: Patients may only access their own FHIR Patient resource');
      }
      return;
    }

    if (user.role === 'DOCTOR' || user.role === 'NURSE') {
      // 1. Check if Trust Relationship is explicitly REVOKED
      let isTrustRevoked = false;
      if (isDbConnected && (prisma as any).trustRelationship?.findFirst) {
        try {
          const rel = await (prisma as any).trustRelationship.findFirst({
            where: {
              OR: [
                { subjectId: targetPatientId, targetUserId: user.id },
                { subjectId: user.id, targetUserId: targetPatientId },
              ],
              status: 'REVOKED',
            },
          });
          if (rel) isTrustRevoked = true;
        } catch {}
      } else if (store?.relationships) {
        const rel = store.relationships.find(
          (r) =>
            ((r.subjectId === targetPatientId && r.targetUserId === user.id) ||
              (r.subjectId === user.id && r.targetUserId === targetPatientId)) &&
            r.status === 'REVOKED'
        );
        if (rel) isTrustRevoked = true;
      }

      if (isTrustRevoked) {
        throw ApiError.forbidden('Access denied by ABAC Policy Engine: Trust relationship has been revoked');
      }

      // 2. Check active consent grant
      let hasConsent = false;
      if (isDbConnected) {
        try {
          const grant = await prisma.accessGrant.findFirst({
            where: {
              doctorId: user.id,
              patientId: targetPatientId,
              status: 'ACTIVE',
              accessExpiry: { gt: new Date() },
            },
          });
          if (grant) hasConsent = true;
        } catch {}
      }
      if (!hasConsent && store.grants) {
        const memGrant = store.grants.find(
          (g) =>
            g.doctorId === user.id &&
            g.patientId === targetPatientId &&
            g.status === 'ACTIVE' &&
            new Date(g.accessExpiry) > new Date()
        );
        if (memGrant) hasConsent = true;
      }

      if (hasConsent) return;

      // 3. Check active emergency break-glass
      let hasEmergency = false;
      if (isDbConnected) {
        try {
          const emergency = await prisma.emergencyEvent.findFirst({
            where: {
              doctorId: user.id,
              patientId: targetPatientId,
              autoRevokeTimestamp: { gt: new Date() },
            },
          });
          if (emergency) hasEmergency = true;
        } catch {}
      }
      if (!hasEmergency && store.emergencies) {
        const memEmergency = store.emergencies.find(
          (e) =>
            e.doctorId === user.id &&
            e.patientId === targetPatientId &&
            new Date(e.autoRevokeTimestamp) > new Date()
        );
        if (memEmergency) hasEmergency = true;
      }

      if (!hasConsent && !hasEmergency) {
        throw ApiError.forbidden('Access denied: Active consent or emergency break-glass required to access FHIR Patient');
      }
      return;
    }

    if (user.role === 'ORGANIZATION_ADMIN') {
      // Must belong to admin's hospital
      let patientOrg: string | null = null;
      if (isDbConnected) {
        try {
          const p = await prisma.user.findFirst({
            where: { OR: [{ id: targetPatientId }, { patientId: targetPatientId }] },
            select: { hospital: true, organizationId: true },
          });
          if (p) patientOrg = p.hospital || p.organizationId;
        } catch {}
      }
      if (!patientOrg && store.users) {
        const memP = store.users.find((u) => u.id === targetPatientId || u.patientId === targetPatientId);
        if (memP) patientOrg = memP.hospital || (memP as any).organizationId;
      }

      if (patientOrg && user.hospital && patientOrg !== user.hospital) {
        throw ApiError.forbidden('Access denied: Organization Admin restricted to own facility patients');
      }
      return;
    }

    throw ApiError.forbidden('Access denied: Insufficient privileges for FHIR Patient resource');
  }

  private async logFhirAccessAudit(params: {
    actor: AuthenticatedUser;
    action: string;
    resourceType: string;
    resourceId?: string;
    patientId?: string;
    status?: AuditStatus;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const auditId = `aud-fhir-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const auditRecord = {
      id: auditId,
      patientId: params.patientId || null,
      actorId: params.actor.id,
      actorName: params.actor.email,
      actorRole: (params.actor.role as unknown) as ActorRole,
      hospital: params.actor.hospital || 'Medrynx Gateway',
      recordType: params.resourceType,
      purpose: `FHIR ${params.action} on ${params.resourceType}${params.resourceId ? `/${params.resourceId}` : ''}`,
      accessType: AuditAccessType.NORMAL,
      status: params.status || AuditStatus.COMPLETED,
      timestamp: new Date(),
      details: params.details || null,
    };

    if (isDbConnected) {
      try {
        await prisma.auditLog.create({
          data: {
            ...auditRecord,
            details: (params.details as any) || undefined,
          },
        });
      } catch {}
    }
    store.auditLogs.unshift(auditRecord as any);
  }

  // =========================================================================
  // 1. PATIENT
  // =========================================================================

  public async getPatientById(id: string, user: AuthenticatedUser): Promise<FhirPatient> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR Patient ID');
    }

    let rawUser: any = null;
    if (isDbConnected) {
      try {
        rawUser = await prisma.user.findFirst({
          where: { OR: [{ id }, { patientId: id }], role: 'PATIENT' },
        });
      } catch {}
    }
    if (!rawUser) {
      rawUser = store.users.find((u) => (u.id === id || u.patientId === id) && u.role === 'PATIENT');
    }

    if (!rawUser) {
      throw ApiError.notFound(`FHIR Patient ${id} not found`);
    }

    await this.authorizePatientAccess(rawUser.id, user);

    const fhirResource = toFhirPatient(rawUser);
    assertValidFhirResource(fhirResource);

    await this.logFhirAccessAudit({
      actor: user,
      action: 'READ',
      resourceType: 'Patient',
      resourceId: fhirResource.id,
      patientId: rawUser.id,
    });

    return fhirResource;
  }

  public async searchPatients(identifier?: string, user?: AuthenticatedUser): Promise<FhirBundle> {
    let patients: any[] = [];
    if (isDbConnected) {
      try {
        patients = await prisma.user.findMany({
          where: {
            role: 'PATIENT',
            ...(identifier ? { OR: [{ id: identifier }, { patientId: identifier }, { email: identifier }] } : {}),
          },
        });
      } catch {}
    }
    if (patients.length === 0) {
      patients = store.users.filter((u) => {
        if (u.role !== 'PATIENT') return false;
        if (!identifier) return true;
        return u.id === identifier || u.patientId === identifier || u.email === identifier;
      });
    }

    // Filter by caller authorization
    const authorizedPatients: FhirPatient[] = [];
    for (const p of patients) {
      try {
        if (user) await this.authorizePatientAccess(p.id, user);
        authorizedPatients.push(toFhirPatient(p));
      } catch {
        // Silently omit unauthorized patients (search enumeration defense)
      }
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-patients-${Date.now()}`,
      type: 'searchset',
      total: authorizedPatients.length,
      entry: authorizedPatients.map((p) => ({
        fullUrl: `/api/v1/fhir/Patient/${p.id}`,
        resource: p,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 2. PRACTITIONER
  // =========================================================================

  public async getPractitionerById(id: string): Promise<FhirPractitioner> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR Practitioner ID');
    }

    let doc: any = null;
    if (isDbConnected) {
      try {
        doc = await prisma.user.findFirst({
          where: { OR: [{ id }, { doctorId: id }], role: { in: ['DOCTOR', 'NURSE'] } },
        });
      } catch {}
    }
    if (!doc) {
      doc = store.users.find(
        (u) => (u.id === id || (u as any).doctorId === id) && (u.role === 'DOCTOR' || u.role === 'NURSE')
      );
    }

    if (!doc) {
      throw ApiError.notFound(`FHIR Practitioner ${id} not found`);
    }

    const practitioner = toFhirPractitioner(doc);
    assertValidFhirResource(practitioner);
    return practitioner;
  }

  public async searchPractitioners(name?: string, identifier?: string): Promise<FhirBundle> {
    let docs: any[] = [];
    if (isDbConnected) {
      try {
        docs = await prisma.user.findMany({
          where: {
            role: { in: ['DOCTOR', 'NURSE'] },
            ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
            ...(identifier ? { OR: [{ id: identifier }, { doctorId: identifier }] } : {}),
          },
        });
      } catch {}
    }
    if (docs.length === 0) {
      docs = store.users.filter((u) => {
        if (u.role !== 'DOCTOR' && u.role !== 'NURSE') return false;
        if (name && !u.name.toLowerCase().includes(name.toLowerCase())) return false;
        if (identifier && u.id !== identifier && (u as any).doctorId !== identifier) return false;
        return true;
      });
    }

    const resources = docs.map((d) => toFhirPractitioner(d));
    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-practitioners-${Date.now()}`,
      type: 'searchset',
      total: resources.length,
      entry: resources.map((r) => ({
        fullUrl: `/api/v1/fhir/Practitioner/${r.id}`,
        resource: r,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 3. ORGANIZATION
  // =========================================================================

  public async getOrganizationById(id: string): Promise<FhirOrganization> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR Organization ID');
    }

    let org: any = null;
    if (isDbConnected) {
      try {
        org = await prisma.organization.findFirst({
          where: { OR: [{ id }, { code: id }] },
        });
      } catch {}
    }
    if (!org) {
      org = store.organizations.find((o) => o.id === id || o.code === id);
    }

    if (!org) {
      throw ApiError.notFound(`FHIR Organization ${id} not found`);
    }

    const fhirOrg = toFhirOrganization(org);
    assertValidFhirResource(fhirOrg);
    return fhirOrg;
  }

  public async searchOrganizations(name?: string): Promise<FhirBundle> {
    let orgs: any[] = [];
    if (isDbConnected) {
      try {
        orgs = await prisma.organization.findMany({
          where: name ? { name: { contains: name, mode: 'insensitive' } } : undefined,
        });
      } catch {}
    }
    if (orgs.length === 0) {
      orgs = name ? store.organizations.filter((o) => o.name.toLowerCase().includes(name.toLowerCase())) : store.organizations;
    }

    const resources = orgs.map((o) => toFhirOrganization(o));
    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-orgs-${Date.now()}`,
      type: 'searchset',
      total: resources.length,
      entry: resources.map((r) => ({
        fullUrl: `/api/v1/fhir/Organization/${r.id}`,
        resource: r,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 4. ENCOUNTER (from EmergencyEvent or Clinical Consultation)
  // =========================================================================

  public async getEncounterById(id: string, user: AuthenticatedUser): Promise<FhirEncounter> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR Encounter ID');
    }

    let emergency: any = null;
    if (isDbConnected) {
      try {
        emergency = await prisma.emergencyEvent.findUnique({ where: { id } });
      } catch {}
    }
    if (!emergency) {
      emergency = store.emergencies?.find((e) => e.id === id);
    }

    if (!emergency) {
      throw ApiError.notFound(`FHIR Encounter ${id} not found`);
    }

    // Authorize encounter access
    if (user.role === 'PATIENT' && user.id !== emergency.patientId && user.patientId !== emergency.patientId) {
      throw ApiError.forbidden('Access denied: Patients may only access their own FHIR Encounters');
    }
    if (user.role === 'DOCTOR' && user.id !== emergency.doctorId) {
      // Must hold active trust or consent
      await this.authorizePatientAccess(emergency.patientId, user);
    }

    const encounter = toFhirEncounter(emergency);
    assertValidFhirResource(encounter);

    await this.logFhirAccessAudit({
      actor: user,
      action: 'READ',
      resourceType: 'Encounter',
      resourceId: encounter.id,
      patientId: emergency.patientId,
    });

    return encounter;
  }

  public async searchEncounters(patientId?: string, user?: AuthenticatedUser): Promise<FhirBundle> {
    let emergencies: any[] = [];
    if (isDbConnected) {
      try {
        emergencies = await prisma.emergencyEvent.findMany({
          where: patientId ? { patientId } : undefined,
          orderBy: { createdAt: 'desc' },
        });
      } catch {}
    }
    if (emergencies.length === 0 && store.emergencies) {
      emergencies = patientId ? store.emergencies.filter((e) => e.patientId === patientId) : store.emergencies;
    }

    const authorizedEncounters: FhirEncounter[] = [];
    for (const em of emergencies) {
      try {
        if (user) {
          if (user.role === 'PATIENT' && user.id !== em.patientId && user.patientId !== em.patientId) continue;
          if (user.role === 'DOCTOR' && user.id !== em.doctorId) {
            await this.authorizePatientAccess(em.patientId, user);
          }
        }
        authorizedEncounters.push(toFhirEncounter(em));
      } catch {
        // omit unauthorized
      }
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-encounters-${Date.now()}`,
      type: 'searchset',
      total: authorizedEncounters.length,
      entry: authorizedEncounters.map((e) => ({
        fullUrl: `/api/v1/fhir/Encounter/${e.id}`,
        resource: e,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 5. CONDITION (from RecordCategory.Clinical)
  // =========================================================================

  public async getConditionById(id: string, user: AuthenticatedUser): Promise<FhirCondition> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR Condition ID');
    }

    let record: any = null;
    if (isDbConnected) {
      try {
        record = await prisma.recordMetadata.findUnique({
          where: { id },
          include: { patient: true },
        });
      } catch {}
    }
    if (!record) {
      record = store.records.find((r) => r.id === id);
    }

    if (!record) {
      throw ApiError.notFound(`FHIR Condition ${id} not found`);
    }

    // Category data minimization
    if (record.category !== RecordCategory.Clinical) {
      throw ApiError.badRequest(`Requested record ${id} is of category ${record.category}, not Clinical condition`);
    }

    // Gated Authorization
    await checkRecordAuthorization(record, user);

    const condition = toFhirCondition(record);
    assertValidFhirResource(condition);

    await this.logFhirAccessAudit({
      actor: user,
      action: 'READ',
      resourceType: 'Condition',
      resourceId: condition.id,
      patientId: record.patientId,
    });

    return condition;
  }

  public async searchConditions(patientId?: string, user?: AuthenticatedUser): Promise<FhirBundle> {
    let records: any[] = [];
    if (isDbConnected) {
      try {
        records = await prisma.recordMetadata.findMany({
          where: {
            category: RecordCategory.Clinical,
            ...(patientId ? { patientId } : {}),
          },
          include: { patient: true },
          orderBy: { recordDate: 'desc' },
        });
      } catch {}
    }
    if (records.length === 0) {
      records = store.records.filter((r) => {
        if (r.category !== RecordCategory.Clinical) return false;
        if (patientId && r.patientId !== patientId) return false;
        return true;
      });
    }

    const authorizedConditions: FhirCondition[] = [];
    for (const r of records) {
      try {
        if (user) await checkRecordAuthorization(r, user);
        authorizedConditions.push(toFhirCondition(r));
      } catch {
        // silently omit unauthorized
      }
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-conditions-${Date.now()}`,
      type: 'searchset',
      total: authorizedConditions.length,
      entry: authorizedConditions.map((c) => ({
        fullUrl: `/api/v1/fhir/Condition/${c.id}`,
        resource: c,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 6. OBSERVATION (from Laboratory, Cardiology, Genomic, Vaccination)
  // =========================================================================

  public async getObservationById(id: string, user: AuthenticatedUser): Promise<FhirObservation> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR Observation ID');
    }

    let record: any = null;
    if (isDbConnected) {
      try {
        record = await prisma.recordMetadata.findUnique({
          where: { id },
          include: { patient: true },
        });
      } catch {}
    }
    if (!record) {
      record = store.records.find((r) => r.id === id);
    }

    if (!record) {
      throw ApiError.notFound(`FHIR Observation ${id} not found`);
    }

    const allowedCategories: RecordCategory[] = [
      RecordCategory.Laboratory,
      RecordCategory.Cardiology,
      RecordCategory.Genomic,
      RecordCategory.Vaccination,
      RecordCategory.Clinical,
    ];

    if (!allowedCategories.includes(record.category)) {
      throw ApiError.badRequest(`Requested record ${id} category (${record.category}) does not contain clinical Observation data`);
    }

    // Gated Authorization
    await checkRecordAuthorization(record, user);

    const observation = toFhirObservation(record);
    assertValidFhirResource(observation);

    await this.logFhirAccessAudit({
      actor: user,
      action: 'READ',
      resourceType: 'Observation',
      resourceId: observation.id,
      patientId: record.patientId,
    });

    return observation;
  }

  public async searchObservations(params: {
    patientId?: string;
    category?: string;
    date?: string;
  }, user?: AuthenticatedUser): Promise<FhirBundle> {
    const allowedCategories: RecordCategory[] = [
      RecordCategory.Laboratory,
      RecordCategory.Cardiology,
      RecordCategory.Genomic,
      RecordCategory.Vaccination,
      RecordCategory.Clinical,
    ];

    let records: any[] = [];
    if (isDbConnected) {
      try {
        records = await prisma.recordMetadata.findMany({
          where: {
            category: { in: allowedCategories },
            ...(params.patientId ? { patientId: params.patientId } : {}),
            ...(params.category ? { category: params.category as RecordCategory } : {}),
          },
          include: { patient: true },
          orderBy: { recordDate: 'desc' },
        });
      } catch {}
    }
    if (records.length === 0) {
      records = store.records.filter((r) => {
        if (!allowedCategories.includes(r.category)) return false;
        if (params.patientId && r.patientId !== params.patientId) return false;
        if (params.category && r.category.toLowerCase() !== params.category.toLowerCase()) return false;
        return true;
      });
    }

    const authorizedObservations: FhirObservation[] = [];
    for (const r of records) {
      try {
        if (user) await checkRecordAuthorization(r, user);
        authorizedObservations.push(toFhirObservation(r));
      } catch {
        // omit unauthorized
      }
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-observations-${Date.now()}`,
      type: 'searchset',
      total: authorizedObservations.length,
      entry: authorizedObservations.map((o) => ({
        fullUrl: `/api/v1/fhir/Observation/${o.id}`,
        resource: o,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 7. DIAGNOSTIC REPORT (from Laboratory, Imaging, Cardiology, Genomic)
  // =========================================================================

  public async getDiagnosticReportById(id: string, user: AuthenticatedUser): Promise<FhirDiagnosticReport> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR DiagnosticReport ID');
    }

    let record: any = null;
    if (isDbConnected) {
      try {
        record = await prisma.recordMetadata.findUnique({
          where: { id },
          include: { patient: true },
        });
      } catch {}
    }
    if (!record) {
      record = store.records.find((r) => r.id === id);
    }

    if (!record) {
      throw ApiError.notFound(`FHIR DiagnosticReport ${id} not found`);
    }

    const allowedCategories: RecordCategory[] = [
      RecordCategory.Laboratory,
      RecordCategory.Imaging,
      RecordCategory.Cardiology,
      RecordCategory.Genomic,
    ];

    if (!allowedCategories.includes(record.category)) {
      throw ApiError.badRequest(`Requested record ${id} category (${record.category}) is not a DiagnosticReport`);
    }

    // Gated Authorization
    await checkRecordAuthorization(record, user);

    const report = toFhirDiagnosticReport(record);
    assertValidFhirResource(report);

    await this.logFhirAccessAudit({
      actor: user,
      action: 'READ',
      resourceType: 'DiagnosticReport',
      resourceId: report.id,
      patientId: record.patientId,
    });

    return report;
  }

  public async searchDiagnosticReports(params: {
    patientId?: string;
    date?: string;
  }, user?: AuthenticatedUser): Promise<FhirBundle> {
    const allowedCategories: RecordCategory[] = [
      RecordCategory.Laboratory,
      RecordCategory.Imaging,
      RecordCategory.Cardiology,
      RecordCategory.Genomic,
    ];

    let records: any[] = [];
    if (isDbConnected) {
      try {
        records = await prisma.recordMetadata.findMany({
          where: {
            category: { in: allowedCategories },
            ...(params.patientId ? { patientId: params.patientId } : {}),
          },
          include: { patient: true },
          orderBy: { recordDate: 'desc' },
        });
      } catch {}
    }
    if (records.length === 0) {
      records = store.records.filter((r) => {
        if (!allowedCategories.includes(r.category)) return false;
        if (params.patientId && r.patientId !== params.patientId) return false;
        return true;
      });
    }

    const authorizedReports: FhirDiagnosticReport[] = [];
    for (const r of records) {
      try {
        if (user) await checkRecordAuthorization(r, user);
        authorizedReports.push(toFhirDiagnosticReport(r));
      } catch {
        // omit unauthorized
      }
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-diagreports-${Date.now()}`,
      type: 'searchset',
      total: authorizedReports.length,
      entry: authorizedReports.map((dr) => ({
        fullUrl: `/api/v1/fhir/DiagnosticReport/${dr.id}`,
        resource: dr,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 8. MEDICATION REQUEST (from RecordCategory.Medication)
  // =========================================================================

  public async getMedicationRequestById(id: string, user: AuthenticatedUser): Promise<FhirMedicationRequest> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR MedicationRequest ID');
    }

    let record: any = null;
    if (isDbConnected) {
      try {
        record = await prisma.recordMetadata.findUnique({
          where: { id },
          include: { patient: true },
        });
      } catch {}
    }
    if (!record) {
      record = store.records.find((r) => r.id === id);
    }

    if (!record) {
      throw ApiError.notFound(`FHIR MedicationRequest ${id} not found`);
    }

    if (record.category !== RecordCategory.Medication) {
      throw ApiError.badRequest(`Requested record ${id} category (${record.category}) is not Medication`);
    }

    // Gated Authorization
    await checkRecordAuthorization(record, user);

    const medReq = toFhirMedicationRequest(record);
    assertValidFhirResource(medReq);

    await this.logFhirAccessAudit({
      actor: user,
      action: 'READ',
      resourceType: 'MedicationRequest',
      resourceId: medReq.id,
      patientId: record.patientId,
    });

    return medReq;
  }

  public async searchMedicationRequests(params: {
    patientId?: string;
    status?: string;
  }, user?: AuthenticatedUser): Promise<FhirBundle> {
    let records: any[] = [];
    if (isDbConnected) {
      try {
        records = await prisma.recordMetadata.findMany({
          where: {
            category: RecordCategory.Medication,
            ...(params.patientId ? { patientId: params.patientId } : {}),
          },
          include: { patient: true },
          orderBy: { recordDate: 'desc' },
        });
      } catch {}
    }
    if (records.length === 0) {
      records = store.records.filter((r) => {
        if (r.category !== RecordCategory.Medication) return false;
        if (params.patientId && r.patientId !== params.patientId) return false;
        return true;
      });
    }

    const authorizedMedRequests: FhirMedicationRequest[] = [];
    for (const r of records) {
      try {
        if (user) await checkRecordAuthorization(r, user);
        authorizedMedRequests.push(toFhirMedicationRequest(r));
      } catch {
        // omit unauthorized
      }
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-medrequests-${Date.now()}`,
      type: 'searchset',
      total: authorizedMedRequests.length,
      entry: authorizedMedRequests.map((m) => ({
        fullUrl: `/api/v1/fhir/MedicationRequest/${m.id}`,
        resource: m,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 9. DOCUMENT REFERENCE
  // =========================================================================

  public async getDocumentReferenceById(id: string, user: AuthenticatedUser): Promise<FhirDocumentReference> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR DocumentReference ID');
    }

    let rec: any = null;
    if (isDbConnected) {
      try {
        rec = await prisma.recordMetadata.findUnique({
          where: { id },
          include: { patient: true },
        });
      } catch {}
    }
    if (!rec) {
      rec = store.records.find((r) => r.id === id);
    }

    if (!rec) {
      throw ApiError.notFound(`FHIR DocumentReference ${id} not found`);
    }

    await checkRecordAuthorization(rec, user);

    const doc = toFhirDocumentReference(rec);
    assertValidFhirResource(doc);

    await this.logFhirAccessAudit({
      actor: user,
      action: 'READ',
      resourceType: 'DocumentReference',
      resourceId: doc.id,
      patientId: rec.patientId,
    });

    return doc;
  }

  public async searchDocumentReferences(patientId?: string, user?: AuthenticatedUser): Promise<FhirBundle> {
    let records: any[] = [];
    if (isDbConnected) {
      try {
        records = await prisma.recordMetadata.findMany({
          where: patientId ? { patientId } : undefined,
          include: { patient: true },
          orderBy: { recordDate: 'desc' },
        });
      } catch {}
    }
    if (records.length === 0) {
      records = patientId ? store.records.filter((r) => r.patientId === patientId) : store.records;
    }

    const authorizedDocs: FhirDocumentReference[] = [];
    for (const r of records) {
      try {
        if (user) await checkRecordAuthorization(r, user);
        authorizedDocs.push(toFhirDocumentReference(r));
      } catch {
        // omit unauthorized
      }
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-docrefs-${Date.now()}`,
      type: 'searchset',
      total: authorizedDocs.length,
      entry: authorizedDocs.map((d) => ({
        fullUrl: `/api/v1/fhir/DocumentReference/${d.id}`,
        resource: d,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 10. CONSENT
  // =========================================================================

  public async getConsentById(id: string, user: AuthenticatedUser): Promise<FhirConsent> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR Consent ID');
    }

    let grant: any = null;
    if (isDbConnected) {
      try {
        grant = await prisma.accessGrant.findUnique({ where: { id } });
      } catch {}
    }
    if (!grant) {
      grant = store.grants?.find((g) => g.id === id);
    }

    if (!grant) {
      throw ApiError.notFound(`FHIR Consent ${id} not found`);
    }

    // Authorize consent access
    if (user.role === 'PATIENT' && user.id !== grant.patientId && user.patientId !== grant.patientId) {
      throw ApiError.forbidden('Access denied: Patients may only access their own FHIR Consents');
    }
    if (user.role === 'DOCTOR' && user.id !== grant.doctorId) {
      await this.authorizePatientAccess(grant.patientId, user);
    }

    const consent = toFhirConsent(grant);
    assertValidFhirResource(consent);
    return consent;
  }

  public async searchConsents(patientId?: string, user?: AuthenticatedUser): Promise<FhirBundle> {
    let grants: any[] = [];
    if (isDbConnected) {
      try {
        grants = await prisma.accessGrant.findMany({
          where: patientId ? { patientId } : undefined,
          orderBy: { createdAt: 'desc' },
        });
      } catch {}
    }
    if (grants.length === 0 && store.grants) {
      grants = patientId ? store.grants.filter((g) => g.patientId === patientId) : store.grants;
    }

    const authorizedConsents: FhirConsent[] = [];
    for (const g of grants) {
      try {
        if (user) {
          if (user.role === 'PATIENT' && user.id !== g.patientId && user.patientId !== g.patientId) continue;
          if (user.role === 'DOCTOR' && user.id !== g.doctorId) {
            await this.authorizePatientAccess(g.patientId, user);
          }
        }
        authorizedConsents.push(toFhirConsent(g));
      } catch {
        // omit unauthorized
      }
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-consents-${Date.now()}`,
      type: 'searchset',
      total: authorizedConsents.length,
      entry: authorizedConsents.map((c) => ({
        fullUrl: `/api/v1/fhir/Consent/${c.id}`,
        resource: c,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 11. AUDIT EVENT
  // =========================================================================

  public async getAuditEventById(id: string, user: AuthenticatedUser): Promise<FhirAuditEvent> {
    if (id.includes('..') || id.includes('/') || id.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in FHIR AuditEvent ID');
    }

    let audit: any = null;
    if (isDbConnected) {
      try {
        audit = await prisma.auditLog.findUnique({ where: { id } });
      } catch {}
    }
    if (!audit) {
      audit = store.auditLogs.find((a) => a.id === id);
    }

    if (!audit) {
      throw ApiError.notFound(`FHIR AuditEvent ${id} not found`);
    }

    // Scoping
    if (user.role === 'PATIENT' && audit.patientId && audit.patientId !== user.id && audit.patientId !== user.patientId) {
      throw ApiError.forbidden('Access denied: Patients may only access their own FHIR AuditEvents');
    }

    const fhirAudit = toFhirAuditEvent(audit);
    assertValidFhirResource(fhirAudit);
    return fhirAudit;
  }

  public async searchAuditEvents(user: AuthenticatedUser): Promise<FhirBundle> {
    let audits: any[] = [];
    if (isDbConnected) {
      try {
        audits = await prisma.auditLog.findMany({
          where: user.role === 'PATIENT' ? { patientId: user.id } : undefined,
          orderBy: { timestamp: 'desc' },
          take: 50,
        });
      } catch {}
    }
    if (audits.length === 0) {
      audits = user.role === 'PATIENT'
        ? store.auditLogs.filter((a) => a.patientId === user.id || a.patientId === user.patientId).slice(0, 50)
        : store.auditLogs.slice(0, 50);
    }

    const resources = audits.map((a) => toFhirAuditEvent(a));
    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `bundle-audits-${Date.now()}`,
      type: 'searchset',
      total: resources.length,
      entry: resources.map((a) => ({
        fullUrl: `/api/v1/fhir/AuditEvent/${a.id}`,
        resource: a,
      })),
    };

    assertValidFhirBundle(bundle);
    return bundle;
  }

  // =========================================================================
  // 12. FULL FHIR PATIENT EXPORT (WITH BLOCKCHAIN AUDIT ANCHORING)
  // =========================================================================

  public async exportPatientBundle(patientId: string, user: AuthenticatedUser): Promise<{
    bundle: FhirBundle;
    evidenceHash: string;
    onChainTxHash?: string;
  }> {
    if (patientId.includes('..') || patientId.includes('/') || patientId.includes('\\')) {
      throw ApiError.badRequest('Path traversal detected in patientId');
    }

    // 1. Authorize patient access first
    await this.authorizePatientAccess(patientId, user);

    // 2. Fetch patient resource
    const patientResource = await this.getPatientById(patientId, user);

    // 3. Collect all authorized records for this patient
    let records: any[] = [];
    if (isDbConnected) {
      try {
        records = await prisma.recordMetadata.findMany({
          where: { patientId },
          include: { patient: true },
          orderBy: { recordDate: 'desc' },
        });
      } catch {}
    }
    if (records.length === 0) {
      records = store.records.filter((r) => r.patientId === patientId);
    }

    const entries: any[] = [
      {
        fullUrl: `/api/v1/fhir/Patient/${patientResource.id}`,
        resource: patientResource,
      },
    ];

    for (const r of records) {
      try {
        await checkRecordAuthorization(r, user);

        // DocumentReference always included
        entries.push({
          fullUrl: `/api/v1/fhir/DocumentReference/${r.id}`,
          resource: toFhirDocumentReference(r),
        });

        // Category-specific mapping
        if (r.category === RecordCategory.Clinical) {
          entries.push({
            fullUrl: `/api/v1/fhir/Condition/${r.id}`,
            resource: toFhirCondition(r),
          });
        }
        if (
          r.category === RecordCategory.Laboratory ||
          r.category === RecordCategory.Cardiology ||
          r.category === RecordCategory.Genomic ||
          r.category === RecordCategory.Vaccination
        ) {
          entries.push({
            fullUrl: `/api/v1/fhir/Observation/${r.id}`,
            resource: toFhirObservation(r),
          });
        }
        if (
          r.category === RecordCategory.Laboratory ||
          r.category === RecordCategory.Imaging ||
          r.category === RecordCategory.Cardiology ||
          r.category === RecordCategory.Genomic
        ) {
          entries.push({
            fullUrl: `/api/v1/fhir/DiagnosticReport/${r.id}`,
            resource: toFhirDiagnosticReport(r),
          });
        }
        if (r.category === RecordCategory.Medication) {
          entries.push({
            fullUrl: `/api/v1/fhir/MedicationRequest/${r.id}`,
            resource: toFhirMedicationRequest(r),
          });
        }
      } catch {
        // Silently omit unauthorized records (Data Minimization)
      }
    }

    const bundle: FhirBundle = {
      resourceType: 'Bundle',
      id: `export-${patientId}-${Date.now()}`,
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: entries.length,
      entry: entries,
    };

    // 4. Validate complete Bundle
    assertValidFhirBundle(bundle);

    // 5. Generate Zero-PHI Canonical Evidence Payload & Hash
    const evidencePayload = buildCanonicalEvidencePayload({
      evidenceType: 'FHIR_EXPORT',
      entityType: 'PATIENT_BUNDLE',
      entityId: bundle.id,
      patientId,
      actorId: user.id,
      organizationId: user.hospital || null,
      action: 'FHIR_EXPORT_COLLECTION',
      timestamp: bundle.timestamp,
      details: {
        totalResources: bundle.total,
        exportFormat: 'application/fhir+json',
      },
    });

    const evidenceHash = computeCanonicalHash(evidencePayload);

    // 6. Anchor export event to blockchain
    let onChainTxHash: string | undefined;
    try {
      const receipt = await blockchainService.anchorAuditEvent({
        evidenceHash,
        actor: user.id,
        action: 'FHIR_EXPORT',
        category: 'INTEROPERABILITY',
        entityId: bundle.id,
      });
      onChainTxHash = receipt.txHash;
    } catch {
      // safe fallback if blockchain temporarily unavailable
    }

    // 7. Record system audit log
    await this.logFhirAccessAudit({
      actor: user,
      action: 'EXPORT',
      resourceType: 'Bundle',
      resourceId: bundle.id,
      patientId,
      details: {
        evidenceHash,
        onChainTxHash,
        totalResources: bundle.total,
      },
    });

    return {
      bundle,
      evidenceHash,
      onChainTxHash,
    };
  }
}

export const fhirService = new FhirService();
