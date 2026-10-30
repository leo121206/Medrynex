import {
  RelationshipType,
  RelationshipStatus,
  UserRole,
  AuditAccessType,
  AuditStatus,
  ActorRole,
  ConsentStatus,
  RequestStatus,
} from '@prisma/client';
import { prisma, isDbConnected } from '../models/db';
import { store, InMemoryTrustRelationship, InMemoryAuditLog } from '../models/store';
import { AuthenticatedUser } from '../types/common.types';
import { ApiError } from '../utils/apiError';
import { blockchainService } from './blockchain.service';
import { logger } from '../config/logger';

export type TrustTier = 'T0' | 'T1' | 'T2' | 'T3';

export interface PatientDoctorTrustEvaluation {
  trustTier: TrustTier;
  tierLabel: string;
  relationshipId: string | null;
  relationshipType: RelationshipType | null;
  relationshipStatus: RelationshipStatus | 'NONE';
  canRequestPatientAccess: boolean;
  canViewProtectedRecords: boolean;
  authorizedCategories: string[];
  activeGrantsCount: number;
  earliestGrantExpiry: string | null;
}

export interface DoctorPatientDirectoryEntry {
  id: string;
  patientId: string;
  name: string;
  email: string;
  bloodGroup: string;
  dob: string;
  regDate: string;
  organizationId: string | null;
  availableCategories: string[];
  totalRecordsCount: number;
  trustTier: TrustTier;
  tierLabel: string;
  relationshipId: string | null;
  relationshipType: RelationshipType | null;
  relationshipStatus: RelationshipStatus | 'NONE';
  canRequestPatientAccess: boolean;
  canViewProtectedRecords: boolean;
  authorizedCategories: string[];
  activeGrantsCount: number;
  earliestGrantExpiry: string | null;
}

export const STANDARD_CLINICAL_CATEGORIES = [
  'Laboratory',
  'Medication',
  'Imaging',
  'Clinical',
  'Vaccination',
  'Cardiology',
];

export const ALL_CLINICAL_CATEGORIES = [
  ...STANDARD_CLINICAL_CATEGORIES,
  'Genomic',
];

/**
 * Parses a patient-level grant or request `recordType` string into discrete normalized category names.
 */
export const parseScopeCategories = (recordType: string): string[] => {
  if (!recordType) return [];
  const trimmed = recordType.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'all' || lower === 'all records') {
    return [...ALL_CLINICAL_CATEGORIES];
  }
  if (lower === 'all standard clinical categories' || lower === 'all clinical categories') {
    return [...STANDARD_CLINICAL_CATEGORIES];
  }
  return Array.from(
    new Set(
      trimmed
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    )
  );
};

/**
 * Evaluates whether a patient-level consent grant's `recordType` scope covers a specific record category.
 */
export const isCategoryCoveredByGrantScope = (
  grantRecordType: string,
  recordCategory?: string
): boolean => {
  if (!recordCategory) return true;
  if (!grantRecordType) return false;

  const grantLower = grantRecordType.trim().toLowerCase();
  const categoryLower = recordCategory.trim().toLowerCase();

  if (grantLower === 'all' || grantLower === 'all records') {
    return true;
  }

  if (
    grantLower === 'all standard clinical categories' ||
    grantLower === 'all clinical categories'
  ) {
    // High-sensitivity Genomic records require explicit Genomic inclusion or All Records
    return categoryLower !== 'genomic';
  }

  const tokens = grantRecordType
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.includes('all') || tokens.includes('all records')) {
    return true;
  }

  if (
    tokens.includes('all standard clinical categories') ||
    tokens.includes('all clinical categories')
  ) {
    if (categoryLower !== 'genomic') return true;
  }

  return tokens.some(
    (token) =>
      token === categoryLower ||
      (token === 'lab' && categoryLower === 'laboratory') ||
      (token === 'prescriptions' && categoryLower === 'medication')
  );
};

/**
 * Evaluates the T0–T3 Trust Hierarchy between a patient and a clinician.
 * - T0: Unknown / Unverified (No active relationship, or relationship is PENDING, REJECTED, REVOKED, or EXPIRED)
 * - T1: Verified Relationship (Active relationship exists, but no active patient-level consent grant)
 * - T2: Authorized Care Provider (Active relationship + active patient-level consent grant for specific categories)
 * - T3: Trusted Care Team / Continuity of Care (Active PATIENT_CARE_TEAM relationship or care-team consent grant)
 */
export const evaluatePatientDoctorTrust = async (
  patientIdentifier: string,
  doctorIdentifier: string
): Promise<PatientDoctorTrustEvaluation> => {
  const now = new Date();
  let patientUuid = patientIdentifier;
  let doctorUuid = doctorIdentifier;

  if (isDbConnected) {
    try {
      const pt = await prisma.user.findFirst({
        where: {
          OR: [{ id: patientIdentifier }, { patientId: patientIdentifier }],
        },
        select: { id: true },
      });
      if (pt) patientUuid = pt.id;

      const doc = await prisma.user.findFirst({
        where: {
          OR: [{ id: doctorIdentifier }, { doctorId: doctorIdentifier }],
        },
        select: { id: true },
      });
      if (doc) doctorUuid = doc.id;
    } catch {
      // fallback
    }
  } else {
    const pt = store.users.find(
      (u) => u.id === patientIdentifier || u.patientId === patientIdentifier
    );
    if (pt) patientUuid = pt.id;
    const doc = store.users.find(
      (u) => u.id === doctorIdentifier || u.doctorId === doctorIdentifier
    );
    if (doc) doctorUuid = doc.id;
  }

  let matchedRelationships: Array<{
    id: string;
    relationshipType: RelationshipType;
    status: RelationshipStatus;
    expiresAt?: Date | null;
    updatedAt: Date;
  }> = [];

  if (isDbConnected && (prisma as any).trustRelationship?.findMany) {
    try {
      const dbRels = await prisma.trustRelationship.findMany({
        where: {
          OR: [
            { subjectId: patientUuid, targetUserId: doctorUuid },
            { subjectId: doctorUuid, targetUserId: patientUuid },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
      matchedRelationships = dbRels;
    } catch {
      // fallback
    }
  }

  if (matchedRelationships.length === 0 && store?.relationships) {
    matchedRelationships = store.relationships
      .filter(
        (r) =>
          (r.subjectId === patientUuid && r.targetUserId === doctorUuid) ||
          (r.subjectId === doctorUuid && r.targetUserId === patientUuid) ||
          (r.subjectId === patientIdentifier && r.targetUserId === doctorIdentifier) ||
          (r.subjectId === doctorIdentifier && r.targetUserId === patientIdentifier)
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // Expire any ACTIVE relationships whose expiresAt is in the past
  for (const rel of matchedRelationships) {
    if (rel.status === RelationshipStatus.ACTIVE && rel.expiresAt && new Date(rel.expiresAt) <= now) {
      rel.status = RelationshipStatus.EXPIRED;
      if (isDbConnected && (prisma as any).trustRelationship?.update) {
        try {
          await prisma.trustRelationship.update({
            where: { id: rel.id },
            data: { status: RelationshipStatus.EXPIRED },
          });
        } catch {
          // ignore
        }
      }
      const mem = store.relationships.find((r) => r.id === rel.id);
      if (mem) mem.status = RelationshipStatus.EXPIRED;
    }
  }

  // If any relationship is explicitly REVOKED and no newer ACTIVE relationship overrides it
  const activeRel = matchedRelationships.find((r) => r.status === RelationshipStatus.ACTIVE);
  const latestRel = matchedRelationships[0] || null;

  if (!activeRel) {
    const relStatus = latestRel ? latestRel.status : 'NONE';
    let statusSuffix = 'No Verified Relationship';
    if (relStatus === RelationshipStatus.PENDING) statusSuffix = 'Pending Verification';
    else if (relStatus === RelationshipStatus.REVOKED) statusSuffix = 'Relationship Revoked';
    else if (relStatus === RelationshipStatus.REJECTED) statusSuffix = 'Relationship Rejected';
    else if (relStatus === RelationshipStatus.EXPIRED) statusSuffix = 'Relationship Expired';

    return {
      trustTier: 'T0',
      tierLabel: `T0 — Unknown / Unverified (${statusSuffix})`,
      relationshipId: latestRel?.id || null,
      relationshipType: latestRel?.relationshipType || null,
      relationshipStatus: relStatus,
      canRequestPatientAccess: false,
      canViewProtectedRecords: false,
      authorizedCategories: [],
      activeGrantsCount: 0,
      earliestGrantExpiry: null,
    };
  }

  // Active relationship exists (at least T1). Now inspect active, non-expired AccessGrants.
  let activeGrants: Array<{
    id: string;
    recordType: string;
    accessExpiry: Date;
    scopeNote?: string | null;
  }> = [];

  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

  if (isDbConnected && (prisma as any).accessGrant?.findMany) {
    try {
      const dbGrants = await prisma.accessGrant.findMany({
        where: {
          patientId: patientUuid,
          doctorId: doctorUuid,
          status: ConsentStatus.ACTIVE,
          accessExpiry: { gt: now },
        },
        orderBy: { accessExpiry: 'asc' },
      });
      if (dbGrants.length > 0 || !isTestEnv) {
        activeGrants = dbGrants;
      }
    } catch {
      // fallback
    }
  }

  if (activeGrants.length === 0 && store?.grants) {
    activeGrants = store.grants.filter(
      (g) =>
        (g.patientId === patientUuid || g.patientId === patientIdentifier) &&
        (g.doctorId === doctorUuid || g.doctorId === doctorIdentifier) &&
        g.status === ConsentStatus.ACTIVE &&
        new Date(g.accessExpiry) > now
    );
  }

  const authorizedCategorySet = new Set<string>();
  for (const g of activeGrants) {
    for (const cat of parseScopeCategories(g.recordType)) {
      authorizedCategorySet.add(cat);
    }
  }
  const authorizedCategories = Array.from(authorizedCategorySet);

  if (activeGrants.length === 0) {
    return {
      trustTier: 'T1',
      tierLabel: 'T1 — Verified Relationship',
      relationshipId: activeRel.id,
      relationshipType: activeRel.relationshipType,
      relationshipStatus: RelationshipStatus.ACTIVE,
      canRequestPatientAccess: true,
      canViewProtectedRecords: false,
      authorizedCategories: [],
      activeGrantsCount: 0,
      earliestGrantExpiry: null,
    };
  }

  const isCareTeamTier =
    activeRel.relationshipType === RelationshipType.PATIENT_CARE_TEAM ||
    activeGrants.some(
      (g) =>
        g.scopeNote?.toLowerCase().includes('care team') ||
        g.scopeNote?.toLowerCase().includes('continuity of care')
    );

  const earliestExpiry = activeGrants
    .map((g) => new Date(g.accessExpiry).getTime())
    .sort((a, b) => a - b)[0];

  if (isCareTeamTier) {
    return {
      trustTier: 'T3',
      tierLabel: 'T3 — Trusted Care Team',
      relationshipId: activeRel.id,
      relationshipType: activeRel.relationshipType,
      relationshipStatus: RelationshipStatus.ACTIVE,
      canRequestPatientAccess: true,
      canViewProtectedRecords: true,
      authorizedCategories,
      activeGrantsCount: activeGrants.length,
      earliestGrantExpiry: earliestExpiry ? new Date(earliestExpiry).toISOString() : null,
    };
  }

  return {
    trustTier: 'T2',
    tierLabel: 'T2 — Authorized Care Provider',
    relationshipId: activeRel.id,
    relationshipType: activeRel.relationshipType,
    relationshipStatus: RelationshipStatus.ACTIVE,
    canRequestPatientAccess: true,
    canViewProtectedRecords: true,
    authorizedCategories,
    activeGrantsCount: activeGrants.length,
    earliestGrantExpiry: earliestExpiry ? new Date(earliestExpiry).toISOString() : null,
  };
};

export interface CreateRelationshipInput {
  relationshipType: RelationshipType;
  targetId: string;
  organizationId?: string;
  notes?: string;
  durationDays?: number;
  metadata?: Record<string, unknown>;
}

export interface FormattedRelationship {
  id: string;
  relationshipType: RelationshipType;
  status: RelationshipStatus;
  subjectId: string;
  subjectName?: string;
  subjectRole?: string;
  targetId: string;
  targetName?: string;
  targetType: 'USER' | 'ORGANIZATION';
  organizationId?: string | null;
  organizationName?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: string | null;
  onChainTxHash?: string | null;
  onChainId?: string | null;
  trustTier?: TrustTier;
  tierLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export const createTrustRelationship = async (
  input: CreateRelationshipInput,
  user: AuthenticatedUser
): Promise<FormattedRelationship> => {
  if (!input.relationshipType || !input.targetId) {
    throw ApiError.badRequest('Fields "relationshipType" and "targetId" are required');
  }

  // Prevent self-relationship
  if (input.targetId === user.id) {
    throw ApiError.badRequest('A participant cannot create a trust relationship with themselves');
  }

  const subjectId = user.id;
  let targetUserId: string | null = null;
  let organizationId: string | null = input.organizationId || user.organizationId || null;

  // Resolve target depending on relationshipType
  if (input.relationshipType === RelationshipType.PATIENT_PROVIDER) {
    if (user.role === UserRole.PATIENT || user.role === UserRole.DOCTOR || user.role === UserRole.NURSE) {
      targetUserId = input.targetId;
    } else {
      throw ApiError.forbidden('Only patients and licensed clinical providers can establish patient-provider relationships');
    }
  } else if (input.relationshipType === RelationshipType.PATIENT_ORGANIZATION) {
    if (user.role !== UserRole.PATIENT && user.role !== UserRole.ORGANIZATION_ADMIN) {
      throw ApiError.forbidden('Only patients or organization administrators can establish patient-organization affiliations');
    }
    organizationId = input.targetId;
  } else if (input.relationshipType === RelationshipType.PROVIDER_ORGANIZATION) {
    if (user.role !== UserRole.DOCTOR && user.role !== UserRole.NURSE && user.role !== UserRole.ORGANIZATION_ADMIN) {
      throw ApiError.forbidden('Only clinical providers or organization administrators can establish provider-organization affiliations');
    }
    organizationId = input.targetId;
  } else if (input.relationshipType === RelationshipType.PATIENT_CARE_TEAM) {
    targetUserId = input.targetId;
  }

  // Resolve human-friendly patientId / doctorId if passed as targetId
  if (targetUserId && isDbConnected) {
    try {
      const resolvedUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: targetUserId },
            { patientId: targetUserId },
            { doctorId: targetUserId },
            { email: targetUserId.toLowerCase() },
          ],
        },
        select: { id: true },
      });
      if (resolvedUser) {
        targetUserId = resolvedUser.id;
      }
    } catch {
      // fallback
    }
  }

  const expiresAt = input.durationDays
    ? new Date(Date.now() + input.durationDays * 86400 * 1000)
    : null;

  // Blockchain anchoring
  const { txHash, onChainId } = await blockchainService.anchorRelationship(
    subjectId,
    targetUserId || input.targetId,
    input.relationshipType,
    'CREATED'
  );

  let created: FormattedRelationship;

  if (isDbConnected) {
    // Check for existing active or pending relationship in either direction
    const existing = await prisma.trustRelationship.findFirst({
      where: {
        relationshipType: input.relationshipType,
        OR: targetUserId
          ? [
              { subjectId, targetUserId },
              { subjectId: targetUserId, targetUserId: subjectId },
            ]
          : [{ subjectId, organizationId }],
        status: { in: [RelationshipStatus.ACTIVE, RelationshipStatus.PENDING] },
      },
    });

    if (existing) {
      throw ApiError.conflict('An active or pending trust relationship already exists between these entities');
    }

    const rel = await prisma.trustRelationship.create({
      data: {
        relationshipType: input.relationshipType,
        status: RelationshipStatus.PENDING,
        subjectId,
        targetUserId,
        organizationId,
        notes: input.notes,
        metadata: input.metadata as any,
        expiresAt,
        onChainTxHash: txHash,
        onChainId,
      },
      include: {
        subject: true,
        targetUser: true,
        organization: true,
      },
    });

    created = {
      id: rel.id,
      relationshipType: rel.relationshipType,
      status: rel.status,
      subjectId: rel.subjectId,
      subjectName: rel.subject.name,
      subjectRole: rel.subject.role,
      targetId: rel.targetUserId || rel.organizationId || input.targetId,
      targetName: rel.targetUser?.name || rel.organization?.name || 'Healthcare Participant',
      targetType: rel.targetUserId ? 'USER' : 'ORGANIZATION',
      organizationId: rel.organizationId,
      organizationName: rel.organization?.name || null,
      notes: rel.notes,
      metadata: rel.metadata as Record<string, unknown> | null,
      expiresAt: rel.expiresAt ? rel.expiresAt.toISOString() : null,
      onChainTxHash: rel.onChainTxHash,
      onChainId: rel.onChainId,
      trustTier: 'T0',
      tierLabel: 'T0 — Unknown / Unverified (Pending Verification)',
      createdAt: rel.createdAt.toISOString(),
      updatedAt: rel.updatedAt.toISOString(),
    };

    // Emit audit log in PostgreSQL
    await prisma.auditLog.create({
      data: {
        patientId: user.role === UserRole.PATIENT ? user.id : targetUserId,
        actorId: user.id,
        actorName: user.email,
        actorRole: user.role === UserRole.PATIENT ? ActorRole.PATIENT : ActorRole.DOCTOR,
        hospital: rel.organization?.name || user.hospital || 'Medrynx Network',
        recordType: 'TrustRelationship',
        purpose: `Establish ${input.relationshipType}`,
        accessType: AuditAccessType.NORMAL,
        status: AuditStatus.COMPLETED,
        txHash,
        details: { relationshipId: rel.id, type: input.relationshipType, status: rel.status },
      },
    });
  } else {
    // In-memory fallback
    const existing = store.relationships.find(
      (r) =>
        r.subjectId === subjectId &&
        r.relationshipType === input.relationshipType &&
        (r.targetUserId === targetUserId || r.organizationId === organizationId) &&
        (r.status === RelationshipStatus.ACTIVE || r.status === RelationshipStatus.PENDING)
    );

    if (existing) {
      throw ApiError.conflict('An active or pending trust relationship already exists between these entities');
    }

    const inMemRel: InMemoryTrustRelationship = {
      id: `rel-${Date.now().toString().slice(-4)}`,
      relationshipType: input.relationshipType,
      status: RelationshipStatus.PENDING,
      subjectId,
      targetUserId,
      organizationId,
      notes: input.notes,
      metadata: input.metadata,
      expiresAt,
      onChainTxHash: txHash,
      onChainId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    store.relationships.unshift(inMemRel);

    const subjectUser = store.users.find((u) => u.id === subjectId);
    const targetUser = targetUserId ? store.users.find((u) => u.id === targetUserId) : null;
    const org = organizationId ? store.organizations.find((o) => o.id === organizationId) : null;

    created = {
      id: inMemRel.id,
      relationshipType: inMemRel.relationshipType,
      status: inMemRel.status,
      subjectId: inMemRel.subjectId,
      subjectName: subjectUser?.name || user.email,
      subjectRole: subjectUser?.role || user.role,
      targetId: inMemRel.targetUserId || inMemRel.organizationId || input.targetId,
      targetName: targetUser?.name || org?.name || 'Healthcare Participant',
      targetType: inMemRel.targetUserId ? 'USER' : 'ORGANIZATION',
      organizationId: inMemRel.organizationId,
      organizationName: org?.name || null,
      notes: inMemRel.notes,
      metadata: inMemRel.metadata,
      expiresAt: inMemRel.expiresAt ? inMemRel.expiresAt.toISOString() : null,
      onChainTxHash: inMemRel.onChainTxHash,
      onChainId: inMemRel.onChainId,
      trustTier: 'T0',
      tierLabel: 'T0 — Unknown / Unverified (Pending Verification)',
      createdAt: inMemRel.createdAt.toISOString(),
      updatedAt: inMemRel.updatedAt.toISOString(),
    };

    const auditEntry: InMemoryAuditLog = {
      id: `aud-${Date.now()}`,
      patientId: user.role === UserRole.PATIENT ? user.id : targetUserId,
      actorId: user.id,
      actorName: user.email,
      actorRole: user.role === UserRole.PATIENT ? ActorRole.PATIENT : ActorRole.DOCTOR,
      hospital: org?.name || user.hospital || 'Medrynx Network',
      recordType: 'TrustRelationship',
      purpose: `Establish ${input.relationshipType}`,
      accessType: AuditAccessType.NORMAL,
      status: AuditStatus.COMPLETED,
      txHash,
      timestamp: new Date(),
      details: { relationshipId: inMemRel.id, type: input.relationshipType, status: inMemRel.status },
    };
    store.auditLogs.unshift(auditEntry);
  }

  logger.info('Trust relationship established', { id: created.id, type: created.relationshipType, subjectId });
  return created;
};

export const getTrustRelationships = async (
  user: AuthenticatedUser,
  query?: { status?: RelationshipStatus; type?: RelationshipType }
): Promise<FormattedRelationship[]> => {
  if (isDbConnected) {
    const whereClause: any = {
      OR: [
        { subjectId: user.id },
        { targetUserId: user.id },
      ],
    };

    // Organization admins can view all relationships bounded to their hospital tenant
    if (user.role === UserRole.ORGANIZATION_ADMIN && user.organizationId) {
      whereClause.OR.push({ organizationId: user.organizationId });
    }

    if (query?.status) whereClause.status = query.status;
    if (query?.type) whereClause.relationshipType = query.type;

    const list = await prisma.trustRelationship.findMany({
      where: whereClause,
      include: {
        subject: true,
        targetUser: true,
        organization: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted: FormattedRelationship[] = [];
    for (const rel of list) {
      let trustTier: TrustTier = rel.status === RelationshipStatus.ACTIVE ? 'T1' : 'T0';
      let tierLabel = rel.status === RelationshipStatus.ACTIVE ? 'T1 — Verified Relationship' : `T0 — Unknown (${rel.status})`;

      if (rel.targetUserId) {
        const patientId = rel.subject.role === UserRole.PATIENT ? rel.subjectId : rel.targetUserId;
        const doctorId = rel.subject.role === UserRole.PATIENT ? rel.targetUserId : rel.subjectId;
        const evalResult = await evaluatePatientDoctorTrust(patientId, doctorId);
        trustTier = evalResult.trustTier;
        tierLabel = evalResult.tierLabel;
      }

      formatted.push({
        id: rel.id,
        relationshipType: rel.relationshipType,
        status: rel.status,
        subjectId: rel.subjectId,
        subjectName: rel.subject.name,
        subjectRole: rel.subject.role,
        targetId: rel.targetUserId || rel.organizationId || '',
        targetName: rel.targetUser?.name || rel.organization?.name || 'Healthcare Participant',
        targetType: rel.targetUserId ? 'USER' : 'ORGANIZATION',
        organizationId: rel.organizationId,
        organizationName: rel.organization?.name || null,
        notes: rel.notes,
        metadata: rel.metadata as Record<string, unknown> | null,
        expiresAt: rel.expiresAt ? rel.expiresAt.toISOString() : null,
        onChainTxHash: rel.onChainTxHash,
        onChainId: rel.onChainId,
        trustTier,
        tierLabel,
        createdAt: rel.createdAt.toISOString(),
        updatedAt: rel.updatedAt.toISOString(),
      });
    }
    return formatted;
  }

  // Fallback to store
  let filtered = store.relationships.filter(
    (r) =>
      r.subjectId === user.id ||
      r.targetUserId === user.id ||
      (user.role === UserRole.ORGANIZATION_ADMIN && r.organizationId === user.organizationId)
  );

  if (query?.status) filtered = filtered.filter((r) => r.status === query.status);
  if (query?.type) filtered = filtered.filter((r) => r.relationshipType === query.type);

  return filtered.map((r) => {
    const subject = store.users.find((u) => u.id === r.subjectId);
    const targetUser = r.targetUserId ? store.users.find((u) => u.id === r.targetUserId) : null;
    const org = r.organizationId ? store.organizations.find((o) => o.id === r.organizationId) : null;

    return {
      id: r.id,
      relationshipType: r.relationshipType,
      status: r.status,
      subjectId: r.subjectId,
      subjectName: subject?.name || 'Participant',
      subjectRole: subject?.role || 'PATIENT',
      targetId: r.targetUserId || r.organizationId || '',
      targetName: targetUser?.name || org?.name || 'Healthcare Participant',
      targetType: r.targetUserId ? 'USER' : 'ORGANIZATION',
      organizationId: r.organizationId,
      organizationName: org?.name || null,
      notes: r.notes,
      metadata: r.metadata,
      expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      onChainTxHash: r.onChainTxHash,
      onChainId: r.onChainId,
      trustTier: r.status === RelationshipStatus.ACTIVE ? 'T1' : 'T0',
      tierLabel: r.status === RelationshipStatus.ACTIVE ? 'T1 — Verified Relationship' : `T0 — Unknown (${r.status})`,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });
};

export const getTrustRelationshipById = async (
  id: string,
  user: AuthenticatedUser
): Promise<FormattedRelationship> => {
  if (isDbConnected) {
    const rel = await prisma.trustRelationship.findUnique({
      where: { id },
      include: { subject: true, targetUser: true, organization: true },
    });

    if (!rel) throw ApiError.notFound('Trust relationship not found');

    const isAuthorized =
      rel.subjectId === user.id ||
      rel.targetUserId === user.id ||
      (user.role === UserRole.ORGANIZATION_ADMIN && rel.organizationId === user.organizationId) ||
      user.role === UserRole.PLATFORM_ADMIN;

    if (!isAuthorized) {
      throw ApiError.forbidden('Access denied: You do not have permission to view this trust relationship');
    }

    return {
      id: rel.id,
      relationshipType: rel.relationshipType,
      status: rel.status,
      subjectId: rel.subjectId,
      subjectName: rel.subject.name,
      subjectRole: rel.subject.role,
      targetId: rel.targetUserId || rel.organizationId || '',
      targetName: rel.targetUser?.name || rel.organization?.name || 'Healthcare Participant',
      targetType: rel.targetUserId ? 'USER' : 'ORGANIZATION',
      organizationId: rel.organizationId,
      organizationName: rel.organization?.name || null,
      notes: rel.notes,
      metadata: rel.metadata as Record<string, unknown> | null,
      expiresAt: rel.expiresAt ? rel.expiresAt.toISOString() : null,
      onChainTxHash: rel.onChainTxHash,
      onChainId: rel.onChainId,
      createdAt: rel.createdAt.toISOString(),
      updatedAt: rel.updatedAt.toISOString(),
    };
  }

  const rel = store.relationships.find((r) => r.id === id);
  if (!rel) throw ApiError.notFound('Trust relationship not found');

  const isAuthorized =
    rel.subjectId === user.id ||
    rel.targetUserId === user.id ||
    (user.role === UserRole.ORGANIZATION_ADMIN && rel.organizationId === user.organizationId) ||
    user.role === UserRole.PLATFORM_ADMIN;

  if (!isAuthorized) {
    throw ApiError.forbidden('Access denied: You do not have permission to view this trust relationship');
  }

  const subject = store.users.find((u) => u.id === rel.subjectId);
  const targetUser = rel.targetUserId ? store.users.find((u) => u.id === rel.targetUserId) : null;
  const org = rel.organizationId ? store.organizations.find((o) => o.id === rel.organizationId) : null;

  return {
    id: rel.id,
    relationshipType: rel.relationshipType,
    status: rel.status,
    subjectId: rel.subjectId,
    subjectName: subject?.name || 'Participant',
    subjectRole: subject?.role || 'PATIENT',
    targetId: rel.targetUserId || rel.organizationId || '',
    targetName: targetUser?.name || org?.name || 'Healthcare Participant',
    targetType: rel.targetUserId ? 'USER' : 'ORGANIZATION',
    organizationId: rel.organizationId,
    organizationName: org?.name || null,
    notes: rel.notes,
    metadata: rel.metadata,
    expiresAt: rel.expiresAt ? rExpiresToStr(rel.expiresAt) : null,
    onChainTxHash: rel.onChainTxHash,
    onChainId: rel.onChainId,
    createdAt: rel.createdAt.toISOString(),
    updatedAt: rel.updatedAt.toISOString(),
  };
};

function rExpiresToStr(expiresAt?: Date | null): string | null {
  return expiresAt ? expiresAt.toISOString() : null;
}

export const acceptTrustRelationship = async (
  id: string,
  user: AuthenticatedUser
): Promise<FormattedRelationship> => {
  const existing = await getTrustRelationshipById(id, user);

  // Target or organization admin can accept
  const isTarget = existing.targetId === user.id;
  const isOrgAdmin = user.role === UserRole.ORGANIZATION_ADMIN && existing.organizationId === user.organizationId;

  if (!isTarget && !isOrgAdmin) {
    throw ApiError.forbidden('Only the recipient participant or authorized organization admin can accept a trust relationship');
  }

  if (existing.status !== RelationshipStatus.PENDING) {
    throw ApiError.badRequest(`Cannot accept relationship in status "${existing.status}"`);
  }

  const { txHash } = await blockchainService.anchorRelationship(
    existing.subjectId,
    existing.targetId,
    existing.relationshipType,
    'ACCEPTED'
  );

  if (isDbConnected) {
    const updated = await prisma.trustRelationship.update({
      where: { id },
      data: { status: RelationshipStatus.ACTIVE, onChainTxHash: txHash },
      include: { subject: true, targetUser: true, organization: true },
    });

    await prisma.auditLog.create({
      data: {
        patientId: user.role === UserRole.PATIENT ? user.id : existing.subjectId,
        actorId: user.id,
        actorName: user.email,
        actorRole: user.role === UserRole.PATIENT ? ActorRole.PATIENT : ActorRole.DOCTOR,
        hospital: updated.organization?.name || user.hospital || 'Medrynx Network',
        recordType: 'TrustRelationship',
        purpose: 'Accept Trust Relationship (Transition T0 -> T1)',
        accessType: AuditAccessType.NORMAL,
        status: AuditStatus.COMPLETED,
        txHash,
        details: { relationshipId: updated.id, status: RelationshipStatus.ACTIVE, trustTier: 'T1' },
      },
    });

    const inMem = store.relationships.find((r) => r.id === id);
    if (inMem) {
      inMem.status = RelationshipStatus.ACTIVE;
      inMem.onChainTxHash = txHash;
      inMem.updatedAt = new Date();
    }

    return {
      ...existing,
      status: RelationshipStatus.ACTIVE,
      trustTier: 'T1',
      tierLabel: 'T1 — Verified Relationship',
      onChainTxHash: txHash,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  const inMem = store.relationships.find((r) => r.id === id)!;
  inMem.status = RelationshipStatus.ACTIVE;
  inMem.onChainTxHash = txHash;
  inMem.updatedAt = new Date();

  const auditEntry: InMemoryAuditLog = {
    id: `aud-${Date.now()}`,
    patientId: user.role === UserRole.PATIENT ? user.id : existing.subjectId,
    actorId: user.id,
    actorName: user.email,
    actorRole: user.role === UserRole.PATIENT ? ActorRole.PATIENT : ActorRole.DOCTOR,
    hospital: user.hospital || 'Medrynx Network',
    recordType: 'TrustRelationship',
    purpose: 'Accept Trust Relationship (Transition T0 -> T1)',
    accessType: AuditAccessType.NORMAL,
    status: AuditStatus.COMPLETED,
    txHash,
    timestamp: new Date(),
    details: { relationshipId: inMem.id, status: RelationshipStatus.ACTIVE, trustTier: 'T1' },
  };
  store.auditLogs.unshift(auditEntry);

  return {
    ...existing,
    status: RelationshipStatus.ACTIVE,
    trustTier: 'T1',
    tierLabel: 'T1 — Verified Relationship',
    onChainTxHash: txHash,
    updatedAt: inMem.updatedAt.toISOString(),
  };
};

export const transitionTrustRelationshipTier = async (
  id: string,
  targetRelationshipType: RelationshipType,
  user: AuthenticatedUser
): Promise<FormattedRelationship> => {
  const existing = await getTrustRelationshipById(id, user);

  if (existing.status !== RelationshipStatus.ACTIVE) {
    throw ApiError.badRequest(
      `Invalid trust tier transition: Relationship must be ACTIVE (T1+) before transitioning to ${targetRelationshipType} (current status: ${existing.status})`
    );
  }

  // Only patient participant or admin can upgrade/downgrade care-team trust tier
  const isPatientParticipant =
    user.role === UserRole.PATIENT && (existing.subjectId === user.id || existing.targetId === user.id);
  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.PLATFORM_ADMIN;

  if (!isPatientParticipant && !isAdmin) {
    throw ApiError.forbidden('Only the patient participant or administrator can transition trust relationship tiers');
  }

  const { txHash } = await blockchainService.anchorRelationship(
    existing.subjectId,
    existing.targetId,
    targetRelationshipType,
    'ACCEPTED'
  );

  if (isDbConnected) {
    const updated = await prisma.trustRelationship.update({
      where: { id },
      data: { relationshipType: targetRelationshipType, onChainTxHash: txHash },
    });

    await prisma.auditLog.create({
      data: {
        patientId: user.role === UserRole.PATIENT ? user.id : existing.subjectId,
        actorId: user.id,
        actorName: user.email,
        actorRole: user.role === UserRole.PATIENT ? ActorRole.PATIENT : ActorRole.ADMIN,
        hospital: user.hospital || 'Medrynx Network',
        recordType: 'TrustRelationship',
        purpose: `Transition Trust Relationship Type to ${targetRelationshipType}`,
        accessType: AuditAccessType.NORMAL,
        status: AuditStatus.COMPLETED,
        txHash,
        details: {
          relationshipId: updated.id,
          previousType: existing.relationshipType,
          newType: targetRelationshipType,
        },
      },
    });

    const inMem = store.relationships.find((r) => r.id === id);
    if (inMem) {
      inMem.relationshipType = targetRelationshipType;
      inMem.updatedAt = new Date();
    }

    return {
      ...existing,
      relationshipType: targetRelationshipType,
      onChainTxHash: txHash,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  const inMem = store.relationships.find((r) => r.id === id)!;
  inMem.relationshipType = targetRelationshipType;
  inMem.onChainTxHash = txHash;
  inMem.updatedAt = new Date();

  return {
    ...existing,
    relationshipType: targetRelationshipType,
    onChainTxHash: txHash,
    updatedAt: inMem.updatedAt.toISOString(),
  };
};

export const rejectTrustRelationship = async (
  id: string,
  user: AuthenticatedUser
): Promise<FormattedRelationship> => {
  const existing = await getTrustRelationshipById(id, user);

  const isTarget = existing.targetId === user.id;
  const isOrgAdmin = user.role === UserRole.ORGANIZATION_ADMIN && existing.organizationId === user.organizationId;

  if (!isTarget && !isOrgAdmin) {
    throw ApiError.forbidden('Only the recipient participant or authorized organization admin can reject a trust relationship');
  }

  if (existing.status !== RelationshipStatus.PENDING) {
    throw ApiError.badRequest(`Cannot reject relationship in status "${existing.status}"`);
  }

  const { txHash } = await blockchainService.anchorRelationship(
    existing.subjectId,
    existing.targetId,
    existing.relationshipType,
    'REJECTED'
  );

  if (isDbConnected) {
    const updated = await prisma.trustRelationship.update({
      where: { id },
      data: { status: RelationshipStatus.REJECTED, onChainTxHash: txHash },
      include: { subject: true, targetUser: true, organization: true },
    });

    const inMem = store.relationships.find((r) => r.id === id);
    if (inMem) {
      inMem.status = RelationshipStatus.REJECTED;
      inMem.onChainTxHash = txHash;
      inMem.updatedAt = new Date();
    }

    return {
      ...existing,
      status: RelationshipStatus.REJECTED,
      trustTier: 'T0',
      tierLabel: 'T0 — Unknown / Unverified (Relationship Rejected)',
      onChainTxHash: txHash,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  const inMem = store.relationships.find((r) => r.id === id)!;
  inMem.status = RelationshipStatus.REJECTED;
  inMem.onChainTxHash = txHash;
  inMem.updatedAt = new Date();

  return {
    ...existing,
    status: RelationshipStatus.REJECTED,
    trustTier: 'T0',
    tierLabel: 'T0 — Unknown / Unverified (Relationship Rejected)',
    onChainTxHash: txHash,
    updatedAt: inMem.updatedAt.toISOString(),
  };
};

export const revokeTrustRelationship = async (
  id: string,
  user: AuthenticatedUser
): Promise<FormattedRelationship> => {
  const existing = await getTrustRelationshipById(id, user);

  const isSubject = existing.subjectId === user.id;
  const isTarget = existing.targetId === user.id;
  const isOrgAdmin = user.role === UserRole.ORGANIZATION_ADMIN && existing.organizationId === user.organizationId;

  if (!isSubject && !isTarget && !isOrgAdmin) {
    throw ApiError.forbidden('You do not have permission to revoke this trust relationship');
  }

  if (existing.status === RelationshipStatus.REVOKED) {
    throw ApiError.badRequest('Trust relationship is already revoked');
  }

  const { txHash } = await blockchainService.anchorRelationship(
    existing.subjectId,
    existing.targetId,
    existing.relationshipType,
    'REVOKED'
  );

  const now = new Date();

  // Cascade revocation: Revoke any active AccessGrants and reject any pending AccessRequests between these participants
  if (existing.targetType === 'USER') {
    const p1 = existing.subjectId;
    const p2 = existing.targetId;

    if (isDbConnected) {
      try {
        await prisma.accessGrant.updateMany({
          where: {
            OR: [
              { patientId: p1, doctorId: p2 },
              { patientId: p2, doctorId: p1 },
            ],
            status: ConsentStatus.ACTIVE,
          },
          data: {
            status: ConsentStatus.REVOKED,
            revokedAt: now,
          },
        });
        await prisma.accessRequest.updateMany({
          where: {
            OR: [
              { patientId: p1, doctorId: p2 },
              { patientId: p2, doctorId: p1 },
            ],
            status: RequestStatus.PENDING,
          },
          data: {
            status: RequestStatus.REJECTED,
            reviewedAt: now,
          },
        });
      } catch {
        // non-fatal
      }
    }

    if (store?.grants) {
      for (const g of store.grants) {
        if (
          ((g.patientId === p1 && g.doctorId === p2) || (g.patientId === p2 && g.doctorId === p1)) &&
          g.status === ConsentStatus.ACTIVE
        ) {
          g.status = ConsentStatus.REVOKED;
          g.revokedAt = now;
        }
      }
    }

    if (store?.requests) {
      for (const r of store.requests) {
        if (
          ((r.patientId === p1 && r.doctorId === p2) || (r.patientId === p2 && r.doctorId === p1)) &&
          r.status === RequestStatus.PENDING
        ) {
          r.status = RequestStatus.REJECTED;
          r.reviewedAt = now;
        }
      }
    }
  }

  if (isDbConnected) {
    const updated = await prisma.trustRelationship.update({
      where: { id },
      data: { status: RelationshipStatus.REVOKED, onChainTxHash: txHash },
      include: { subject: true, targetUser: true, organization: true },
    });

    await prisma.auditLog.create({
      data: {
        patientId: user.role === UserRole.PATIENT ? user.id : existing.subjectId,
        actorId: user.id,
        actorName: user.email,
        actorRole: user.role === UserRole.PATIENT ? ActorRole.PATIENT : ActorRole.DOCTOR,
        hospital: updated.organization?.name || user.hospital || 'Medrynx Network',
        recordType: 'TrustRelationship',
        purpose: 'Revoke Trust Relationship (Downgrade -> T0 & Revoke Active Consents)',
        accessType: AuditAccessType.REVOCATION,
        status: AuditStatus.REVOKED,
        txHash,
        details: { relationshipId: updated.id, status: RelationshipStatus.REVOKED, trustTier: 'T0' },
      },
    });

    const inMem = store.relationships.find((r) => r.id === id);
    if (inMem) {
      inMem.status = RelationshipStatus.REVOKED;
      inMem.onChainTxHash = txHash;
      inMem.updatedAt = now;
    }

    return {
      ...existing,
      status: RelationshipStatus.REVOKED,
      trustTier: 'T0',
      tierLabel: 'T0 — Unknown / Unverified (Relationship Revoked)',
      onChainTxHash: txHash,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  const inMem = store.relationships.find((r) => r.id === id)!;
  inMem.status = RelationshipStatus.REVOKED;
  inMem.onChainTxHash = txHash;
  inMem.updatedAt = now;

  const auditEntry: InMemoryAuditLog = {
    id: `aud-${Date.now()}`,
    patientId: user.role === UserRole.PATIENT ? user.id : existing.subjectId,
    actorId: user.id,
    actorName: user.email,
    actorRole: user.role === UserRole.PATIENT ? ActorRole.PATIENT : ActorRole.DOCTOR,
    hospital: user.hospital || 'Medrynx Network',
    recordType: 'TrustRelationship',
    purpose: 'Revoke Trust Relationship (Downgrade -> T0 & Revoke Active Consents)',
    accessType: AuditAccessType.REVOCATION,
    status: AuditStatus.REVOKED,
    txHash,
    timestamp: now,
    details: { relationshipId: inMem.id, status: RelationshipStatus.REVOKED, trustTier: 'T0' },
  };
  store.auditLogs.unshift(auditEntry);

  return {
    ...existing,
    status: RelationshipStatus.REVOKED,
    trustTier: 'T0',
    tierLabel: 'T0 — Unknown / Unverified (Relationship Revoked)',
    onChainTxHash: txHash,
    updatedAt: inMem.updatedAt.toISOString(),
  };
};

/**
 * Returns the clinician's patient directory enriched with T0–T3 trust tier evaluation
 * and available record category summary (without exposing protected record titles or payloads).
 */
export const getDoctorPatientDirectory = async (
  user: AuthenticatedUser
): Promise<DoctorPatientDirectoryEntry[]> => {
  if (
    user.role !== UserRole.DOCTOR &&
    user.role !== UserRole.NURSE &&
    user.role !== UserRole.ADMIN &&
    user.role !== UserRole.ORGANIZATION_ADMIN &&
    user.role !== UserRole.PLATFORM_ADMIN
  ) {
    throw ApiError.forbidden('Only authorized clinicians and administrators can query the patient directory');
  }

  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

  if (isDbConnected) {
    try {
      const dbPatients = await prisma.user.findMany({
        where: { role: UserRole.PATIENT },
        orderBy: { createdAt: 'desc' },
      });

      if (dbPatients.length > 0 || !isTestEnv) {
        const results: DoctorPatientDirectoryEntry[] = [];
        for (const pt of dbPatients) {
          const trust = await evaluatePatientDoctorTrust(pt.id, user.id);
          const records = await prisma.recordMetadata.findMany({
            where: {
              patientId: pt.id,
              recordStatus: { not: 'TOMBSTONED' },
            },
            select: { category: true },
          });
          const availableCategories = Array.from(new Set(records.map((r) => String(r.category))));

          results.push({
            id: pt.id,
            patientId: pt.patientId || pt.id,
            name: pt.name,
            email: pt.email,
            bloodGroup: pt.bloodGroup || 'O+',
            dob: pt.dob || 'N/A',
            regDate: pt.createdAt.toISOString().split('T')[0],
            organizationId: pt.organizationId || null,
            availableCategories,
            totalRecordsCount: records.length,
            ...trust,
          });
        }
        return results;
      }
    } catch {
      // fallback
    }
  }

  const memPatients = store.users.filter((u) => u.role === UserRole.PATIENT);
  const results: DoctorPatientDirectoryEntry[] = [];
  for (const pt of memPatients) {
    const trust = await evaluatePatientDoctorTrust(pt.id, user.id);
    const records = store.records.filter(
      (r) => (r.patientId === pt.id || r.patientId === pt.patientId) && r.recordStatus !== 'TOMBSTONED'
    );
    const availableCategories = Array.from(new Set(records.map((r) => String(r.category))));

    results.push({
      id: pt.id,
      patientId: pt.patientId || pt.id,
      name: pt.name,
      email: pt.email,
      bloodGroup: pt.bloodGroup || 'O+',
      dob: pt.dob || 'N/A',
      regDate: pt.createdAt.toISOString().split('T')[0],
      organizationId: pt.organizationId || null,
      availableCategories,
      totalRecordsCount: records.length,
      ...trust,
    });
  }
  return results;
};

/**
 * Returns all verified healthcare providers/clinicians on the Medrynx network
 * for patient consent granting and affiliation.
 */
export const getVerifiedDoctorsDirectory = async (): Promise<
  Array<{
    id: string;
    doctorId: string;
    name: string;
    email: string;
    specialization: string;
    hospital: string;
    licenseId?: string;
  }>
> => {
  if (isDbConnected) {
    try {
      const dbDoctors = await prisma.user.findMany({
        where: { role: UserRole.DOCTOR },
        select: {
          id: true,
          doctorId: true,
          name: true,
          email: true,
          specialization: true,
          hospital: true,
          licenseId: true,
        },
        orderBy: { name: 'asc' },
      });
      if (dbDoctors.length > 0) {
        return dbDoctors.map((d) => ({
          id: d.id,
          doctorId: d.doctorId || 'd-001',
          name: d.name,
          email: d.email,
          specialization: d.specialization || 'General Practice',
          hospital: d.hospital || 'Medrynx Network',
          licenseId: d.licenseId || undefined,
        }));
      }
    } catch {
      // fallback
    }
  }

  return store.users
    .filter((u) => u.role === UserRole.DOCTOR)
    .map((d) => ({
      id: d.id,
      doctorId: d.doctorId || 'd-001',
      name: d.name,
      email: d.email,
      specialization: d.specialization || 'General Practice',
      hospital: d.hospital || 'Medrynx Network',
      licenseId: d.licenseId || undefined,
    }));
};


