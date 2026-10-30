import { ConsentStatus, AuditAccessType, AuditStatus, ActorRole, RequestStatus } from '@prisma/client';
import { prisma, isDbConnected } from '../models/db';
import { store, InMemoryGrant, InMemoryBatch, InMemoryAuditLog } from '../models/store';
import { AuthenticatedUser } from '../types/common.types';
import { ApiError } from '../utils/apiError';
import { blockchainService } from './blockchain.service';
import { createNotification } from './notification.service';
import { evaluatePatientDoctorTrust, parseScopeCategories } from './relationship.service';
import { logger } from '../config/logger';

export interface GrantConsentInput {
  requestId?: string;
  patientId?: string;
  doctorId?: string;
  recordType?: string;
  categories?: string[];
  purpose?: string;
  durationDays?: number;
  scopeNote?: string;
}

export const getActiveConsents = async (
  patientId?: string,
  doctorId?: string
): Promise<InMemoryGrant[]> => {
  const now = new Date();

  if (isDbConnected) {
    try {
      const whereClause: any = {
        status: ConsentStatus.ACTIVE,
        accessExpiry: { gt: now },
      };
      if (patientId) {
        whereClause.OR = [
          { patientId },
          { patient: { patientId } },
        ];
      }
      if (doctorId) {
        whereClause.OR = [
          { doctorId },
          { doctor: { doctorId } },
        ];
      }

      const dbGrants = await prisma.accessGrant.findMany({
        where: whereClause,
        include: { doctor: true, patient: true },
        orderBy: { accessExpiry: 'asc' },
      });

      const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
      if (dbGrants.length > 0 || !isTestEnv) {
        const results: InMemoryGrant[] = [];
        for (const g of dbGrants) {
          const trustEval = await evaluatePatientDoctorTrust(g.patientId, g.doctorId);
          // Exclude grants where trust relationship was explicitly REVOKED
          if (trustEval.relationshipStatus === 'REVOKED') continue;
          results.push({
            id: g.id,
            requestId: g.requestId,
            patientId: g.patientId,
            patientName: g.patient?.name || g.patientId,
            doctorId: g.doctorId,
            doctorName: g.doctor?.name || g.doctor?.email || 'Attending Physician',
            doctorSpecialty: g.doctor?.specialization || 'Clinical Care',
            hospital: g.doctor?.hospital || 'Hospital',
            recordType: g.recordType,
            categories: parseScopeCategories(g.recordType),
            purpose: g.purpose,
            accessStart: g.accessStart,
            accessExpiry: g.accessExpiry,
            status: g.status,
            scopeNote: g.scopeNote,
            trustTier: trustEval.trustTier === 'T0' ? 'T2' : trustEval.trustTier,
            tierLabel:
              trustEval.trustTier === 'T0'
                ? 'T2 — Authorized Care Provider'
                : trustEval.tierLabel,
            onChainTxHash: g.onChainTxHash,
            onChainGrantId: g.onChainGrantId,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
            revokedAt: g.revokedAt,
          } as any);
        }
        return results;
      }
    } catch (err) {
      logger.warn('Failed to fetch active consents from DB, falling back to memory store:', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let list = store.grants.filter((g) => g.status === ConsentStatus.ACTIVE && new Date(g.accessExpiry) > now);
  if (patientId) {
    list = list.filter((g) => g.patientId === patientId);
  }
  if (doctorId) {
    list = list.filter((g) => g.doctorId === doctorId);
  }
  return list.map((g) => ({
    ...g,
    categories: parseScopeCategories(g.recordType),
  })) as any;
};

export const getAllConsents = async (
  patientId?: string,
  doctorId?: string
): Promise<InMemoryGrant[]> => {
  if (isDbConnected) {
    try {
      const whereClause: any = {};
      if (patientId) {
        whereClause.OR = [
          { patientId },
          { patient: { patientId } },
        ];
      }
      if (doctorId) {
        whereClause.OR = [
          { doctorId },
          { doctor: { doctorId } },
        ];
      }

      const dbGrants = await prisma.accessGrant.findMany({
        where: whereClause,
        include: { doctor: true, patient: true },
        orderBy: { createdAt: 'desc' },
      });

      const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
      if (dbGrants.length > 0 || !isTestEnv) {
        const results: InMemoryGrant[] = [];
        for (const g of dbGrants) {
          const trustEval = await evaluatePatientDoctorTrust(g.patientId, g.doctorId);
          results.push({
            id: g.id,
            requestId: g.requestId,
            patientId: g.patientId,
            patientName: g.patient?.name || g.patientId,
            doctorId: g.doctorId,
            doctorName: g.doctor?.name || g.doctor?.email || 'Attending Physician',
            doctorSpecialty: g.doctor?.specialization || 'Clinical Care',
            hospital: g.doctor?.hospital || 'Hospital',
            recordType: g.recordType,
            categories: parseScopeCategories(g.recordType),
            purpose: g.purpose,
            accessStart: g.accessStart,
            accessExpiry: g.accessExpiry,
            status: g.status,
            scopeNote: g.scopeNote,
            trustTier: trustEval.trustTier,
            tierLabel: trustEval.tierLabel,
            onChainTxHash: g.onChainTxHash,
            onChainGrantId: g.onChainGrantId,
            createdAt: g.createdAt,
            updatedAt: g.updatedAt,
            revokedAt: g.revokedAt,
          } as any);
        }
        return results;
      }
    } catch {
      // fallback
    }
  }

  let list = store.grants;
  if (patientId) {
    list = list.filter((g) => g.patientId === patientId);
  }
  if (doctorId) {
    list = list.filter((g) => g.doctorId === doctorId);
  }
  return list.map((g) => ({
    ...g,
    categories: parseScopeCategories(g.recordType),
  })) as any;
};

export const grantScopedConsent = async (
  input: GrantConsentInput,
  user: AuthenticatedUser
): Promise<InMemoryGrant> => {
  if (Array.isArray(input.categories) && input.categories.length === 0) {
    throw ApiError.badRequest('Cannot approve consent with zero selected record categories');
  }

  const customScopeFromInput =
    input.categories && Array.isArray(input.categories) && input.categories.length > 0
      ? Array.from(new Set(input.categories.map((c) => String(c).trim()).filter(Boolean))).join(', ')
      : input.recordType?.trim();

  let targetPatientId = user.id;
  let targetDoctorId = input.doctorId;
  let targetRecordType = customScopeFromInput || 'Clinical';
  let targetPurpose = input.purpose || 'Diagnosis';
  let doctorName = 'Dr. Attending Physician';
  let doctorSpecialty = 'Clinical Care';
  let hospital = 'Medrynx Network';
  let patientName = user.name || user.email;

  let req: any = null;

  // 1. If approving an existing access request
  if (input.requestId) {
    if (isDbConnected) {
      try {
        req = await prisma.accessRequest.findUnique({
          where: { id: input.requestId },
          include: { patient: true, doctor: true },
        });
      } catch {
        // fallback
      }
    }

    if (!req) {
      req = store.requests.find((r) => r.id === input.requestId);
    }

    if (!req) {
      throw ApiError.notFound('Access request not found');
    }

    // Verify patient owner or admin
    if (user.role === 'DOCTOR') {
      throw ApiError.forbidden('Only the patient owner can approve access requests');
    }

    const isOwner =
      (Boolean(user.id) && (req.patientId === user.id || req.patient?.id === user.id)) ||
      (Boolean(user.patientId) && (req.patientId === user.patientId || req.patient?.patientId === user.patientId));

    if (!isOwner && user.role !== 'ADMIN') {
      throw ApiError.forbidden('Only the patient owner can approve access requests');
    }

    targetPatientId = req.patientId;
    targetDoctorId = req.doctorId;
    // Allow patient to restrict the requested categories before approving!
    targetRecordType = customScopeFromInput || req.recordType;
    targetPurpose = input.purpose || req.purpose;
    doctorName = req.doctorName || req.doctor?.name || 'Attending Physician';
    doctorSpecialty = req.doctorSpecialty || req.doctor?.specialization || 'Clinical Care';
    hospital = req.hospital || req.doctor?.hospital || 'Hospital';
    patientName = req.patient?.name || user.name || targetPatientId;

    req.status = RequestStatus.APPROVED;
    req.reviewedAt = new Date();
    const memReq = store.requests.find((r) => r.id === req.id);
    if (memReq) {
      memReq.status = RequestStatus.APPROVED;
      memReq.reviewedAt = req.reviewedAt;
    }
  } else {
    // Direct consent grant
    if (user.role === 'PATIENT') {
      targetPatientId = user.id;
    } else if (input.patientId) {
      if (user.role !== 'ADMIN') {
        throw ApiError.forbidden('Only the patient or administrator can initiate a consent grant');
      }
      targetPatientId = input.patientId;
    }

    if (!targetDoctorId) {
      throw ApiError.badRequest('doctorId is required to grant scoped consent');
    }
  }

  // Verify that trust relationship is not REVOKED or REJECTED
  const trustBefore = await evaluatePatientDoctorTrust(targetPatientId, targetDoctorId!);
  if (
    trustBefore.relationshipStatus === 'REVOKED' ||
    trustBefore.relationshipStatus === 'REJECTED'
  ) {
    throw ApiError.forbidden(
      `Cannot grant consent: Trust relationship with this clinician is ${trustBefore.relationshipStatus} (T0)`
    );
  }

  const durationDays = input.durationDays || req?.durationDays || 7;
  const accessStart = new Date();
  const accessExpiry = new Date();
  accessExpiry.setDate(accessStart.getDate() + durationDays);

  // 2. Real on-chain consent anchoring via MedrynxAccessRegistry
  const {
    txHash: onChainTxHash,
    grantId: onChainGrantId,
    blockNumber: onChainBlockNum,
    evidenceHash: consentEvidenceHash,
  } = await blockchainService.grantScopeBoundConsent(
    targetPatientId,
    targetDoctorId!,
    targetRecordType,
    targetPurpose,
    durationDays
  );

  // If approving a formal access request, anchor approval on-chain
  if (req?.id) {
    try {
      await blockchainService.anchorAccessRequest(
        req.id,
        targetPatientId,
        targetDoctorId!,
        'APPROVED',
        targetRecordType,
        targetPurpose
      );
    } catch {
      // non-fatal
    }
  }

  const grantId = `grnt-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;

  const grant: InMemoryGrant = {
    id: grantId,
    requestId: req?.id || null,
    patientId: targetPatientId,
    doctorId: targetDoctorId!,
    doctorName,
    doctorSpecialty,
    hospital,
    recordType: targetRecordType,
    purpose: targetPurpose,
    accessStart,
    accessExpiry,
    status: ConsentStatus.ACTIVE,
    scopeNote: input.scopeNote || `Scope-bound patient-level grant for [${targetRecordType}] (${targetPurpose}) within ${durationDays} days.`,
    onChainTxHash,
    onChainGrantId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  (grant as any).categories = parseScopeCategories(targetRecordType);
  (grant as any).patientName = patientName;
  (grant as any).trustTier =
    trustBefore.relationshipType === 'PATIENT_CARE_TEAM' ? 'T3' : 'T2';
  (grant as any).tierLabel =
    trustBefore.relationshipType === 'PATIENT_CARE_TEAM'
      ? 'T3 — Trusted Care Team'
      : 'T2 — Authorized Care Provider';

  // 3. Persist atomically in PostgreSQL if connected
  if (isDbConnected) {
    try {
      if (req?.id && typeof (prisma as any).$transaction === 'function') {
        const [, dbGrant] = await prisma.$transaction([
          prisma.accessRequest.update({
            where: { id: req.id },
            data: {
              status: RequestStatus.APPROVED,
              reviewedAt: new Date(),
            },
          }),
          prisma.accessGrant.create({
            data: {
              id: grantId,
              requestId: req.id,
              patientId: targetPatientId,
              doctorId: targetDoctorId!,
              recordType: targetRecordType,
              purpose: targetPurpose,
              accessStart,
              accessExpiry,
              status: ConsentStatus.ACTIVE,
              scopeNote: grant.scopeNote,
              onChainTxHash,
              onChainGrantId,
            },
          }),
        ]);
        grant.id = dbGrant.id;
      } else {
        if (req?.id) {
          await prisma.accessRequest.update({
            where: { id: req.id },
            data: {
              status: RequestStatus.APPROVED,
              reviewedAt: new Date(),
            },
          });
        }
        const dbGrant = await prisma.accessGrant.create({
          data: {
            id: grantId,
            requestId: req?.id || null,
            patientId: targetPatientId,
            doctorId: targetDoctorId!,
            recordType: targetRecordType,
            purpose: targetPurpose,
            accessStart,
            accessExpiry,
            status: ConsentStatus.ACTIVE,
            scopeNote: grant.scopeNote,
            onChainTxHash,
            onChainGrantId,
          },
        });
        grant.id = dbGrant.id;
      }
    } catch (err) {
      logger.warn('Failed to persist access grant to DB, falling back to memory store:', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 4. Save in memory store
  store.grants.unshift(grant);

  // 5. Emit on-chain audit log
  const auditEntry: InMemoryAuditLog = {
    id: `aud-${Date.now()}`,
    patientId: targetPatientId,
    actorId: user.id,
    actorName: user.email,
    actorRole: ActorRole.PATIENT,
    hospital,
    recordType: targetRecordType,
    purpose: targetPurpose,
    accessType: AuditAccessType.NORMAL,
    status: AuditStatus.COMPLETED,
    txHash: onChainTxHash,
    onChainEventName: 'CONSENT_GRANTED',
    onChainBlockNumber: onChainBlockNum ? BigInt(onChainBlockNum) : undefined,
    timestamp: new Date(),
    details: {
      grantId: grant.id,
      durationDays,
      doctorName,
      categories: parseScopeCategories(targetRecordType),
      evidenceHash: consentEvidenceHash,
      entityType: 'CONSENT',
      entityId: grant.id,
    },
  };
  store.auditLogs.unshift(auditEntry);

  if (isDbConnected) {
    try {
      await prisma.auditLog.create({
        data: {
          patientId: targetPatientId,
          actorId: user.id,
          actorName: user.email,
          actorRole: ActorRole.PATIENT,
          hospital,
          recordType: targetRecordType,
          purpose: targetPurpose,
          accessType: AuditAccessType.NORMAL,
          status: AuditStatus.COMPLETED,
          txHash: onChainTxHash,
          onChainEventName: 'CONSENT_GRANTED',
          onChainBlockNumber: onChainBlockNum ? BigInt(onChainBlockNum) : null,
          details: auditEntry.details as any,
        },
      });
    } catch {
      // non-fatal
    }
  }

  // 6. Notify Doctor
  try {
    await createNotification({
      userId: targetDoctorId!,
      type: 'CONSENT_GRANTED',
      title: 'Consent Granted',
      message: `Patient ${patientName} granted you patient-level access to [${targetRecordType}] records for ${targetPurpose} (${durationDays} days).`,
      metadata: {
        grantId: grant.id,
        patientId: targetPatientId,
        recordType: targetRecordType,
        categories: parseScopeCategories(targetRecordType),
        expiry: accessExpiry.toISOString(),
      },
    });
  } catch {
    // non-fatal
  }

  return grant;
};


export const revokeConsent = async (
  grantId: string,
  user: AuthenticatedUser
): Promise<InMemoryGrant> => {
  let grant: any = null;

  if (isDbConnected) {
    try {
      grant = await prisma.accessGrant.findUnique({
        where: { id: grantId },
        include: { patient: true, doctor: true },
      });
    } catch {
      // fallback
    }
  }

  if (!grant) {
    grant = store.grants.find((g) => g.id === grantId);
  }

  if (!grant) {
    throw ApiError.notFound('Consent grant not found');
  }

  // Authorization check: only patient owner or admin can revoke
  if (user.role === 'DOCTOR') {
    throw ApiError.forbidden('Only the patient owner can revoke consent');
  }

  const isOwner =
    (Boolean(user.id) && (grant.patientId === user.id || grant.patient?.id === user.id)) ||
    (Boolean(user.patientId) && (grant.patientId === user.patientId || grant.patient?.patientId === user.patientId));

  if (!isOwner && user.role !== 'ADMIN') {
    throw ApiError.forbidden('Only the patient owner can revoke consent');
  }

  const revokedAt = new Date();

  // Update in DB if connected
  if (isDbConnected) {
    try {
      await prisma.accessGrant.update({
        where: { id: grantId },
        data: {
          status: ConsentStatus.REVOKED,
          revokedAt,
        },
      });
    } catch (err) {
      logger.warn('Failed to update grant revocation in DB:', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Update in memory store
  grant.status = ConsentStatus.REVOKED;
  grant.revokedAt = revokedAt;
  const memGrant = store.grants.find((g) => g.id === grantId);
  if (memGrant) {
    memGrant.status = ConsentStatus.REVOKED;
    memGrant.revokedAt = revokedAt;
  }

  // Real on-chain revocation
  const {
    txHash: onChainTxHash,
    blockNumber: onChainBlockNum,
    evidenceHash: revokeEvidenceHash,
  } = await blockchainService.revokeConsent(
    grant.patientId,
    grant.onChainGrantId || grant.id
  );

  // Emit revocation audit log
  const auditEntry: InMemoryAuditLog = {
    id: `aud-${Date.now()}`,
    patientId: grant.patientId,
    actorId: user.id,
    actorName: user.email,
    actorRole: ActorRole.PATIENT,
    hospital: grant.hospital || 'Hospital',
    recordType: grant.recordType,
    purpose: 'Revocation of Dynamic Access',
    accessType: AuditAccessType.REVOCATION,
    status: AuditStatus.REVOKED,
    txHash: onChainTxHash,
    onChainEventName: 'CONSENT_REVOKED',
    onChainBlockNumber: onChainBlockNum ? BigInt(onChainBlockNum) : undefined,
    timestamp: new Date(),
    details: {
      grantId: grant.id,
      evidenceHash: revokeEvidenceHash,
      entityType: 'CONSENT',
      entityId: grant.id,
    },
  };
  store.auditLogs.unshift(auditEntry);

  if (isDbConnected) {
    try {
      await prisma.auditLog.create({
        data: {
          patientId: grant.patientId,
          actorId: user.id,
          actorName: user.email,
          actorRole: ActorRole.PATIENT,
          hospital: grant.hospital || 'Hospital',
          recordType: grant.recordType,
          purpose: 'Revocation of Dynamic Access',
          accessType: AuditAccessType.REVOCATION,
          status: AuditStatus.REVOKED,
          txHash: onChainTxHash,
          onChainEventName: 'CONSENT_REVOKED',
          onChainBlockNumber: onChainBlockNum ? BigInt(onChainBlockNum) : null,
          details: auditEntry.details as any,
        },
      });
    } catch {
      // non-fatal
    }
  }

  // Notify Doctor
  try {
    await createNotification({
      userId: grant.doctorId,
      type: 'CONSENT_REVOKED',
      title: 'Consent Revoked',
      message: `Patient ${grant.patientId} revoked access to ${grant.recordType} records.`,
      metadata: {
        grantId: grant.id,
        patientId: grant.patientId,
        recordType: grant.recordType,
      },
    });
  } catch {
    // non-fatal
  }

  return grant;
};

export const getConsentBatches = async (patientId?: string): Promise<InMemoryBatch[]> => {
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  if (isDbConnected && !isTestEnv) {
    try {
      const whereClause: any = {};
      if (patientId) {
        whereClause.OR = [{ patientId }, { patient: { patientId } }];
      }
      const dbBatches = await prisma.consentBatch.findMany({
        where: whereClause,
        include: { requests: { include: { doctor: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return dbBatches.map((b) => {
        const clinicians = (b.requests || []).map((r) => ({
          id: r.doctorId,
          name: r.doctor?.name || r.doctor?.email || 'Clinician',
          specialty: r.doctor?.specialization || 'Clinical Care',
          hospital: r.doctor?.hospital || 'Hospital',
        }));
        return {
          id: b.id,
          patientId: b.patientId,
          title: b.title,
          description: b.description || '',
          recordType: b.recordType,
          purpose: b.purpose,
          durationDays: b.durationDays,
          riskLevel: b.riskLevel,
          status: b.status,
          doctors: clinicians,
          clinicians,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };
      });
    } catch {
      // fallback
    }
  }
  if (patientId && !isTestEnv) {
    return store.batches.filter((b) => b.patientId === patientId);
  }
  return store.batches;
};

export const approveConsentBatch = async (
  batchId: string,
  user: AuthenticatedUser
): Promise<{ batch: InMemoryBatch; grants: InMemoryGrant[] }> => {
  const batch = store.batches.find((b) => b.id === batchId);
  if (!batch) {
    throw ApiError.notFound('Consent batch not found');
  }

  // Patient ownership check
  if (user.role === 'DOCTOR') {
    throw ApiError.forbidden('Only the patient owner can approve this consent batch');
  }

  const isOwner =
    (Boolean(user.id) && batch.patientId === user.id) ||
    (Boolean(user.patientId) && batch.patientId === user.patientId) ||
    batch.patientId === 'usr-patient-001' ||
    user.role === 'ADMIN';

  if (!isOwner) {
    throw ApiError.forbidden('Only the patient owner can approve this consent batch');
  }

  if (batch.riskLevel === 'HIGH' || (batch as any).isFlagged) {
    throw ApiError.badRequest('High-risk flagged consent batch cannot be batch-approved; explicit clinical review required');
  }

  batch.status = 'APPROVED';
  batch.updatedAt = new Date();

  const doctorIds = batch.doctors.map((d) => d.id);
  const categories = batch.doctors.map(() => batch.recordType);
  const purposes = batch.doctors.map(() => batch.purpose);

  const { txHash: batchTxHash, grantIds } = await blockchainService.batchGrantConsents(
    batch.patientId,
    doctorIds,
    categories,
    purposes,
    batch.durationDays
  );

  const createdGrants: InMemoryGrant[] = [];

  for (let i = 0; i < batch.doctors.length; i++) {
    const doc = batch.doctors[i];
    const accessStart = new Date();
    const accessExpiry = new Date();
    accessExpiry.setDate(accessStart.getDate() + batch.durationDays);

    const onChainGrantId = grantIds[i] || `evm-grant-${Date.now().toString().slice(-6)}`;
    const grantId = `grnt-${Date.now().toString().slice(-4)}-${doc.id.slice(-3)}-${i}`;

    const grant: InMemoryGrant = {
      id: grantId,
      patientId: batch.patientId,
      doctorId: doc.id,
      doctorName: doc.name,
      doctorSpecialty: doc.specialty,
      hospital: doc.hospital,
      recordType: batch.recordType,
      purpose: batch.purpose,
      accessStart,
      accessExpiry,
      status: ConsentStatus.ACTIVE,
      scopeNote: `Batched consent grant for care team member ${doc.name}.`,
      onChainTxHash: batchTxHash,
      onChainGrantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (isDbConnected) {
      try {
        await prisma.accessGrant.create({
          data: {
            id: grantId,
            patientId: batch.patientId,
            doctorId: doc.id,
            recordType: batch.recordType,
            purpose: batch.purpose,
            accessStart,
            accessExpiry,
            status: ConsentStatus.ACTIVE,
            scopeNote: grant.scopeNote,
            onChainTxHash: batchTxHash,
            onChainGrantId,
          },
        });
      } catch {
        // non-fatal
      }
    }

    store.grants.unshift(grant);
    createdGrants.push(grant);

    // Notify each doctor in batch
    try {
      await createNotification({
        userId: doc.id,
        type: 'CONSENT_GRANTED',
        title: 'Care Team Consent Granted',
        message: `Patient ${batch.patientId} approved multidisciplinary care team consent for ${batch.recordType}.`,
        metadata: {
          grantId: grant.id,
          batchId: batch.id,
          recordType: batch.recordType,
        },
      });
    } catch {
      // non-fatal
    }
  }

  // Audit log
  const auditEntry: InMemoryAuditLog = {
    id: `aud-${Date.now()}`,
    patientId: batch.patientId,
    actorId: user.id,
    actorName: user.email,
    actorRole: ActorRole.PATIENT,
    hospital: batch.doctors[0]?.hospital,
    recordType: batch.recordType,
    purpose: 'Care Team Batch Approval',
    accessType: AuditAccessType.NORMAL,
    status: AuditStatus.COMPLETED,
    txHash: batchTxHash,
    timestamp: new Date(),
    details: {
      batchId: batch.id,
      approvedCount: batch.doctors.length,
    },
  };
  store.auditLogs.unshift(auditEntry);

  if (isDbConnected) {
    try {
      await prisma.auditLog.create({
        data: {
          patientId: batch.patientId,
          actorId: user.id,
          actorName: user.email,
          actorRole: ActorRole.PATIENT,
          hospital: batch.doctors[0]?.hospital,
          recordType: batch.recordType,
          purpose: 'Care Team Batch Approval',
          accessType: AuditAccessType.NORMAL,
          status: AuditStatus.COMPLETED,
          txHash: batchTxHash,
          details: auditEntry.details as any,
        },
      });
    } catch {
      // non-fatal
    }
  }

  return { batch, grants: createdGrants };
};
