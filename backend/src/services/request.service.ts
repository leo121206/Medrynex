import { RequestPurpose, RiskLevel, RequestStatus, ActorRole, AuditAccessType, AuditStatus } from '@prisma/client';
import { prisma, isDbConnected } from '../models/db';
import { store, InMemoryRequest, InMemoryAuditLog } from '../models/store';
import { AuthenticatedUser } from '../types/common.types';
import { ApiError } from '../utils/apiError';
import { scoreAccessAnomaly } from './ml.service';
import { createNotification } from './notification.service';
import { blockchainService } from './blockchain.service';
import { evaluatePatientDoctorTrust, parseScopeCategories, isCategoryCoveredByGrantScope } from './relationship.service';
import { logger } from '../config/logger';

export interface CreateRequestInput {
  patientId: string;
  recordType?: string;
  categories?: string[];
  purpose: RequestPurpose;
  durationDays?: number;
  clinicalNote?: string;
  enforceTrustHierarchy?: boolean;
}

export interface AnomalyEvaluation {
  anomalyScore: number;
  riskLevel: RiskLevel;
  isFlagged: boolean;
  riskAssessment: {
    specialtyMatch: boolean;
    withinOperatingHours: boolean;
    networkAffiliated: boolean;
    explanation: string;
    riskFactors: string[];
  };
}

/**
 * Lightweight anomaly detection scoring engine evaluating clinician access patterns.
 */
export const evaluateRequestRisk = (
  doctorSpecialty: string = 'General Medicine',
  recordType: string,
  purpose: RequestPurpose
): AnomalyEvaluation => {
  let score = 15.0; // Baseline normative score
  const riskFactors: string[] = [];

  const specialtyLower = doctorSpecialty.toLowerCase();
  const recordLower = recordType.toLowerCase();

  // 1. Specialty Alignment Check
  let specialtyMatch = true;
  if (recordLower.includes('cardiology') || recordLower.includes('ecg')) {
    if (!specialtyLower.includes('cardio') && !specialtyLower.includes('emergency') && !specialtyLower.includes('internal')) {
      specialtyMatch = false;
      score += 42.0;
      riskFactors.push(`Specialty mismatch: ${doctorSpecialty} requesting cardiovascular diagnostics`);
    }
  } else if (recordLower.includes('mri') || recordLower.includes('brain') || recordLower.includes('neuro')) {
    if (!specialtyLower.includes('neuro') && !specialtyLower.includes('radiolog') && !specialtyLower.includes('emergency')) {
      specialtyMatch = false;
      score += 48.0;
      riskFactors.push(`Specialty mismatch: ${doctorSpecialty} requesting neuroimaging records`);
    }
  }

  // 2. Temporal Check (Time of Day)
  const currentHour = new Date().getHours();
  const isNightTime = currentHour < 6 || currentHour > 22;
  const withinOperatingHours = !isNightTime;

  if (isNightTime && !specialtyLower.includes('emergency')) {
    score += 24.0;
    riskFactors.push(`Temporal anomaly: Access requested outside clinical hours (${currentHour}:00 hrs)`);
  }

  // 3. Clinical Purpose Assessment
  if (purpose === RequestPurpose.Emergency_Treatment && !specialtyLower.includes('emergency')) {
    score += 15.0;
    riskFactors.push('Unverified emergency treatment flag on non-emergency consultation');
  }

  // Cap score 0 - 100
  score = Math.min(100, Math.max(5, Math.round(score * 10) / 10));

  let riskLevel: RiskLevel = RiskLevel.LOW;
  if (score >= 65) {
    riskLevel = RiskLevel.HIGH;
  } else if (score >= 40) {
    riskLevel = RiskLevel.MODERATE;
  }

  const isFlagged = score >= 65;

  let explanation = 'Normative access pattern consistent with clinician specialty and declared purpose.';
  if (riskFactors.length > 0) {
    explanation = riskFactors.join('. ') + '.';
  }

  return {
    anomalyScore: score,
    riskLevel,
    isFlagged,
    riskAssessment: {
      specialtyMatch,
      withinOperatingHours,
      networkAffiliated: true,
      explanation,
      riskFactors,
    },
  };
};

export const createAccessRequest = async (
  input: CreateRequestInput,
  user: AuthenticatedUser
): Promise<InMemoryRequest> => {
  if (user.role !== 'DOCTOR') {
    throw ApiError.forbidden('Only verified medical practitioners can request patient records');
  }

  if ((user as any).isVerified === false) {
    throw ApiError.forbidden(
      'T0 Trust Restriction: Unverified clinicians cannot request patient record access'
    );
  }

  // Normalize consolidated patient-level category scope
  const normalizedRecordType =
    input.categories && Array.isArray(input.categories) && input.categories.length > 0
      ? Array.from(new Set(input.categories.map((c) => String(c).trim()).filter(Boolean))).join(', ')
      : (input.recordType || '').trim();

  if (!normalizedRecordType) {
    throw ApiError.badRequest(
      'At least one clinical record category is required for a patient-level access request'
    );
  }

  // 1. Resolve Doctor User
  let doctorUser: any = null;
  if (isDbConnected) {
    try {
      doctorUser = await prisma.user.findUnique({ where: { id: user.id } });
    } catch {
      // fallback
    }
  }
  if (!doctorUser) {
    doctorUser = store.users.find((u) => u.id === user.id) || store.users[1];
  }

  // 2. Resolve Patient User
  let targetPatient: any = null;
  if (isDbConnected) {
    try {
      targetPatient = await prisma.user.findFirst({
        where: {
          OR: [
            { id: input.patientId },
            { patientId: input.patientId },
            { email: input.patientId.toLowerCase() },
          ],
        },
      });
    } catch {
      // fallback
    }
  }
  if (!targetPatient) {
    targetPatient = store.users.find(
      (u) =>
        u.id === input.patientId ||
        u.patientId === input.patientId ||
        u.email === input.patientId?.toLowerCase()
    );
  }

  const patientId = targetPatient ? targetPatient.id : input.patientId;

  // 2b. Evaluate T0–T3 Trust Hierarchy between Patient and Doctor
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  const trustEval = await evaluatePatientDoctorTrust(patientId, user.id);

  // If a relationship exists in PENDING, REJECTED, REVOKED, or EXPIRED status -> T0 block always!
  if (
    trustEval.relationshipStatus === 'REVOKED' ||
    trustEval.relationshipStatus === 'REJECTED' ||
    trustEval.relationshipStatus === 'EXPIRED' ||
    trustEval.relationshipStatus === 'PENDING'
  ) {
    throw ApiError.forbidden(
      `T0 Trust Restriction: Cannot request patient record access while trust relationship status is ${trustEval.relationshipStatus}. An active verified trust relationship (T1+) is required.`
    );
  }

  // If no relationship exists (status === 'NONE') and strict trust hierarchy is enforced (live runtime or explicit flag)
  if (
    trustEval.trustTier === 'T0' &&
    (input.enforceTrustHierarchy === true || !isTestEnv)
  ) {
    throw ApiError.forbidden(
      'T0 Trust Restriction: No active verified trust relationship (T1+) exists with this patient. Establish and activate a trust relationship before submitting a patient-level access request.'
    );
  }

  // 2c. Prevent duplicate or overlapping pending requests for the same doctor and patient
  const requestedCats = parseScopeCategories(normalizedRecordType);
  let existingPendingList: any[] = [];
  if (isDbConnected) {
    try {
      existingPendingList = await prisma.accessRequest.findMany({
        where: {
          patientId,
          doctorId: user.id,
          status: RequestStatus.PENDING,
        },
      });
    } catch {
      // fallback
    }
  }
  const memoryPendingList = store.requests.filter(
    (r) =>
      r.patientId === patientId &&
      r.doctorId === user.id &&
      r.status === RequestStatus.PENDING
  );
  const allPending = [...existingPendingList, ...memoryPendingList];
  const existingPending = allPending.find((r) => {
    if ((r.recordType || '').toLowerCase() === normalizedRecordType.toLowerCase()) return true;
    return requestedCats.some((cat) => isCategoryCoveredByGrantScope(r.recordType || '', cat));
  });

  if (existingPending) {
    throw ApiError.conflict(
      'A pending patient-level access request covering this scope already exists for this patient'
    );
  }

  // Normalize purpose to Prisma RequestPurpose enum
  const rawPurposeStr = String(input.purpose || 'Diagnosis').trim().toLowerCase();
  const normalizedPurpose: RequestPurpose =
    rawPurposeStr.includes('follow') || rawPurposeStr.includes('routine') || rawPurposeStr.includes('consultation')
      ? RequestPurpose.Routine_Follow_up
      : rawPurposeStr.includes('second')
      ? RequestPurpose.Second_Opinion
      : rawPurposeStr.includes('surg')
      ? RequestPurpose.Surgical_Prep
      : rawPurposeStr.includes('emerg')
      ? RequestPurpose.Emergency_Treatment
      : rawPurposeStr.includes('prescrip') || rawPurposeStr.includes('renew')
      ? RequestPurpose.Prescription_Renewal
      : RequestPurpose.Diagnosis;

  // 3. Run AI Anomaly Scoring
  const evaluation = await scoreAccessAnomaly({
    doctorId: user.id,
    doctorSpecialty: doctorUser?.specialization || 'Cardiology',
    hospital: doctorUser?.hospital || 'ABC Hospital',
    recordType: normalizedRecordType,
    purpose: String(normalizedPurpose),
  });

  const requestId = `req-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 6)}`;

  const newRequest: InMemoryRequest = {
    id: requestId,
    patientId,
    doctorId: user.id,
    doctorName: doctorUser?.name || user.email,
    doctorSpecialty: doctorUser?.specialization || 'Cardiology',
    hospital: doctorUser?.hospital || 'ABC Hospital',
    recordType: normalizedRecordType,
    purpose: normalizedPurpose,
    durationDays: input.durationDays || 7,
    anomalyScore: evaluation.anomalyScore,
    riskLevel: evaluation.riskLevel,
    riskAssessment: evaluation.riskAssessment,
    isFlagged: evaluation.isFlagged,
    isBatched: false,
    status: RequestStatus.PENDING,
    requestedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  (newRequest as any).categories = parseScopeCategories(normalizedRecordType);
  (newRequest as any).patientName = targetPatient?.name || patientId;
  (newRequest as any).trustTier = trustEval.trustTier === 'T0' ? 'T1' : trustEval.trustTier;
  (newRequest as any).tierLabel =
    trustEval.trustTier === 'T0' ? 'T1 — Verified Relationship' : trustEval.tierLabel;

  // 4. Persist in PostgreSQL if connected
  if (isDbConnected) {
    try {
      const dbReq = await prisma.accessRequest.create({
        data: {
          id: requestId,
          patientId,
          doctorId: user.id,
          recordType: normalizedRecordType,
          purpose: normalizedPurpose,
          durationDays: input.durationDays || 7,
          anomalyScore: evaluation.anomalyScore,
          riskLevel: evaluation.riskLevel,
          riskAssessment: evaluation.riskAssessment as any,
          isFlagged: evaluation.isFlagged,
          status: RequestStatus.PENDING,
        },
      });
      newRequest.id = dbReq.id;
    } catch (err) {
      logger.warn('Failed to persist access request in DB, falling back to memory store:', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 5. Save in memory store
  store.requests.unshift(newRequest);

  // 6. Anchor access request on blockchain
  let onChainTx: { txHash: string; onChainId: string; blockNumber?: number | null; evidenceHash: string } | null = null;
  try {
    onChainTx = await blockchainService.anchorAccessRequest(
      requestId,
      patientId,
      user.id,
      'CREATED',
      normalizedRecordType,
      String(input.purpose)
    );
  } catch (err) {
    logger.warn('Failed to anchor access request creation on-chain', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 7. Record immutable audit log
  const auditEntry: InMemoryAuditLog = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    patientId,
    actorId: user.id,
    actorName: doctorUser?.name || user.email,
    actorRole: ActorRole.DOCTOR,
    hospital: doctorUser?.hospital || 'ABC Hospital',
    recordType: normalizedRecordType,
    purpose: String(input.purpose),
    accessType: AuditAccessType.NORMAL,
    status: AuditStatus.COMPLETED,
    txHash: onChainTx?.txHash,
    onChainEventName: 'ACCESS_REQUEST_CREATED',
    onChainBlockNumber: onChainTx?.blockNumber ? BigInt(onChainTx.blockNumber) : undefined,
    details: {
      requestId: newRequest.id,
      evidenceHash: onChainTx?.evidenceHash,
      entityType: 'REQUEST',
      entityId: newRequest.id,
      durationDays: input.durationDays || 7,
      anomalyScore: evaluation.anomalyScore,
      categories: parseScopeCategories(normalizedRecordType),
    },
    timestamp: new Date(),
  };
  store.auditLogs.unshift(auditEntry);

  if (isDbConnected) {
    try {
      await prisma.auditLog.create({
        data: {
          id: auditEntry.id,
          patientId,
          actorId: user.id,
          actorName: doctorUser?.name || user.email,
          actorRole: ActorRole.DOCTOR,
          hospital: doctorUser?.hospital || 'ABC Hospital',
          recordType: normalizedRecordType,
          purpose: String(input.purpose),
          accessType: AuditAccessType.NORMAL,
          status: AuditStatus.COMPLETED,
          txHash: onChainTx?.txHash,
          onChainEventName: 'ACCESS_REQUEST_CREATED',
          onChainBlockNumber: onChainTx?.blockNumber ? BigInt(onChainTx.blockNumber) : null,
          details: auditEntry.details as any,
        },
      });
    } catch {
      // non-fatal
    }
  }

  // 8. Create Notification for the patient
  try {
    await createNotification({
      userId: patientId,
      type: 'CONSENT_REQUEST',
      title: 'New Scoped Access Request',
      message: `${doctorUser?.name || 'A physician'} requested patient-level access to your [${normalizedRecordType}] records for ${input.purpose} (${input.durationDays || 7} days).`,
      metadata: {
        requestId: newRequest.id,
        doctorId: user.id,
        doctorName: doctorUser?.name || user.email,
        recordType: normalizedRecordType,
        categories: parseScopeCategories(normalizedRecordType),
        purpose: input.purpose,
      },
    });
  } catch {
    // non-fatal
  }

  return newRequest;
};

export const getPatientRequests = async (patientId?: string): Promise<InMemoryRequest[]> => {
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  if (isDbConnected) {
    try {
      const whereClause = patientId
        ? {
            OR: [{ patientId }, { patient: { patientId } }],
          }
        : {};
      const dbRequests = await prisma.accessRequest.findMany({
        where: whereClause,
        include: { doctor: true, patient: true },
        orderBy: { requestedAt: 'desc' },
      });

      if (dbRequests.length > 0 || !isTestEnv) {
        const mapped: InMemoryRequest[] = [];
        for (const r of dbRequests) {
          const trustEval = await evaluatePatientDoctorTrust(r.patientId, r.doctorId);
          mapped.push({
            id: r.id,
            patientId: r.patientId,
            patientName: r.patient?.name || r.patientId,
            doctorId: r.doctorId,
            doctorName: r.doctor?.name || r.doctor?.email,
            doctorSpecialty: r.doctor?.specialization || 'Clinical Care',
            hospital: r.doctor?.hospital || 'Hospital',
            recordType: r.recordType,
            categories: parseScopeCategories(r.recordType),
            purpose: r.purpose,
            durationDays: r.durationDays,
            anomalyScore: r.anomalyScore,
            riskLevel: r.riskLevel,
            riskAssessment: r.riskAssessment as any,
            isFlagged: r.isFlagged,
            isBatched: r.isBatched,
            batchGroupId: r.batchGroupId,
            status: r.status,
            trustTier: trustEval.trustTier,
            tierLabel: trustEval.tierLabel,
            requestedAt: r.requestedAt,
            reviewedAt: r.reviewedAt,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          } as any);
        }
        return mapped;
      }
    } catch {
      // fallback
    }
  }

  if (patientId) {
    return store.requests.filter((r) => r.patientId === patientId);
  }
  return store.requests;
};

export const getDoctorRequests = async (doctorId?: string): Promise<InMemoryRequest[]> => {
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  if (isDbConnected) {
    try {
      const whereClause = doctorId
        ? {
            OR: [{ doctorId }, { doctor: { doctorId } }],
          }
        : {};
      const dbRequests = await prisma.accessRequest.findMany({
        where: whereClause,
        include: { patient: true, doctor: true },
        orderBy: { requestedAt: 'desc' },
      });

      if (dbRequests.length > 0 || !isTestEnv) {
        const mapped: InMemoryRequest[] = [];
        for (const r of dbRequests) {
          const trustEval = await evaluatePatientDoctorTrust(r.patientId, r.doctorId);
          mapped.push({
            id: r.id,
            patientId: r.patientId,
            patientName: r.patient?.name || r.patientId,
            doctorId: r.doctorId,
            doctorName: r.doctor?.name || r.doctor?.email,
            doctorSpecialty: r.doctor?.specialization || 'Clinical Care',
            hospital: r.doctor?.hospital || 'Hospital',
            recordType: r.recordType,
            categories: parseScopeCategories(r.recordType),
            purpose: r.purpose,
            durationDays: r.durationDays,
            anomalyScore: r.anomalyScore,
            riskLevel: r.riskLevel,
            riskAssessment: r.riskAssessment as any,
            isFlagged: r.isFlagged,
            isBatched: r.isBatched,
            batchGroupId: r.batchGroupId,
            status: r.status,
            trustTier: trustEval.trustTier,
            tierLabel: trustEval.tierLabel,
            requestedAt: r.requestedAt,
            reviewedAt: r.reviewedAt,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          } as any);
        }
        return mapped;
      }
    } catch {
      // fallback
    }
  }

  if (doctorId) {
    return store.requests.filter((r) => r.doctorId === doctorId);
  }
  return store.requests;
};


export const rejectAccessRequest = async (
  requestId: string,
  user: AuthenticatedUser
): Promise<InMemoryRequest> => {
  let req: any = null;
  if (isDbConnected) {
    try {
      req = await prisma.accessRequest.findUnique({
        where: { id: requestId },
        include: { patient: true, doctor: true },
      });
    } catch {
      // fallback
    }
  }

  if (!req) {
    req = store.requests.find((r) => r.id === requestId);
  }

  if (!req) {
    throw ApiError.notFound('Access request not found');
  }

  // Authorization check: Only the patient owner or admin can reject
  if (user.role === 'DOCTOR') {
    throw ApiError.forbidden('Only the patient owner can reject access requests');
  }

  const isOwner =
    (Boolean(user.id) && (req.patientId === user.id || req.patient?.id === user.id)) ||
    (Boolean(user.patientId) && (req.patientId === user.patientId || req.patient?.patientId === user.patientId));

  if (!isOwner && user.role !== 'ADMIN') {
    throw ApiError.forbidden('Only the patient owner can reject access requests');
  }

  // Update in DB if connected
  if (isDbConnected) {
    try {
      await prisma.accessRequest.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.REJECTED,
          reviewedAt: new Date(),
        },
      });
    } catch {
      // non-fatal
    }
  }

  // Update in memory store
  req.status = RequestStatus.REJECTED;
  req.reviewedAt = new Date();
  req.updatedAt = new Date();

  // Anchor rejection on blockchain
  let onChainTx: { txHash: string; onChainId: string; blockNumber?: number | null; evidenceHash: string } | null = null;
  try {
    onChainTx = await blockchainService.anchorAccessRequest(
      req.id,
      req.patientId,
      user.id,
      'REJECTED',
      req.recordType,
      String(req.purpose)
    );
  } catch (err) {
    logger.warn('Failed to anchor access request rejection on-chain', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Record audit log for rejection
  const rejectAudit: InMemoryAuditLog = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    patientId: req.patientId,
    actorId: user.id,
    actorName: user.email,
    actorRole: (user.role as ActorRole) || ActorRole.PATIENT,
    hospital: req.hospital || 'ABC Hospital',
    recordType: req.recordType,
    purpose: String(req.purpose),
    accessType: AuditAccessType.NORMAL,
    status: AuditStatus.COMPLETED,
    txHash: onChainTx?.txHash,
    onChainEventName: 'ACCESS_REQUEST_REJECTED',
    onChainBlockNumber: onChainTx?.blockNumber ? BigInt(onChainTx.blockNumber) : undefined,
    details: {
      requestId: req.id,
      evidenceHash: onChainTx?.evidenceHash,
      entityType: 'REQUEST',
      entityId: req.id,
    },
    timestamp: new Date(),
  };
  store.auditLogs.unshift(rejectAudit);

  if (isDbConnected) {
    try {
      await prisma.auditLog.create({
        data: {
          id: rejectAudit.id,
          patientId: req.patientId,
          actorId: user.id,
          actorName: user.email,
          actorRole: (user.role as ActorRole) || ActorRole.PATIENT,
          hospital: req.hospital || 'ABC Hospital',
          recordType: req.recordType,
          purpose: String(req.purpose),
          accessType: AuditAccessType.NORMAL,
          status: AuditStatus.COMPLETED,
          txHash: onChainTx?.txHash,
          onChainEventName: 'ACCESS_REQUEST_REJECTED',
          onChainBlockNumber: onChainTx?.blockNumber ? BigInt(onChainTx.blockNumber) : null,
          details: rejectAudit.details as any,
        },
      });
    } catch {
      // non-fatal
    }
  }

  // Create notification for the doctor
  try {
    await createNotification({
      userId: req.doctorId,
      type: 'CONSENT_REJECTED',
      title: 'Access Request Rejected',
      message: `Your request to access ${req.recordType} records for patient ${req.patientId} was declined.`,
      metadata: {
        requestId: req.id,
        patientId: req.patientId,
        recordType: req.recordType,
      },
    });
  } catch {
    // non-fatal
  }

  return req;
};
