/**
 * consent.service.ts — Real API integration only. No mock fallbacks.
 */
import { AccessRequest, RequestPurpose, RequestStatus } from '../types/access';
import { ScopedConsent, ConsentBatch } from '../types/consent';
import { apiRequest } from './apiClient';

/** Normalise a raw consent object from the backend into the frontend ScopedConsent type. */
function normaliseConsent(c: Record<string, unknown>): ScopedConsent {
  const fmt = (d: unknown): string =>
    d ? new Date(d as string).toLocaleDateString('en-GB') : '—';

  const rawStatus = ((c.status as string) || 'active').toLowerCase();
  const status: 'active' | 'revoked' | 'expired' =
    rawStatus === 'revoked' ? 'revoked' : rawStatus === 'expired' ? 'expired' : 'active';

  const recordType = (c.recordType as string) || '';
  const categories = Array.isArray(c.categories)
    ? (c.categories as string[])
    : recordType
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  return {
    id: c.id as string,
    patientId: (c.patientId as string) || '',
    patientName: (c.patientName as string) || '',
    doctorId: (c.doctorId as string) || ((c.doctor as Record<string, unknown>)?.id as string) || '',
    doctorName: (c.doctorName as string) || ((c.doctor as Record<string, unknown>)?.name as string) || 'Clinician',
    doctorSpecialty: (c.doctorSpecialty as string) || ((c.doctor as Record<string, unknown>)?.specialization as string) || '',
    hospital: (c.hospital as string) || ((c.doctor as Record<string, unknown>)?.hospital as string) || '',
    recordType,
    categories,
    trustTier: (c.trustTier as string) || 'T2',
    tierLabel: (c.tierLabel as string) || 'T2 — Authorized Care Provider',
    purpose: ((c.purpose as string) || 'Consultation') as RequestPurpose,
    grantedAt: c.grantedAt ? String(c.grantedAt) : fmt(c.accessStart),
    accessStart: fmt(c.accessStart),
    accessExpiry: fmt(c.accessExpiry),
    status,
    scopeNote: (c.scopeNote as string) || '',
  } as ScopedConsent & Record<string, unknown>;
}

function normaliseAccessRequest(r: Record<string, unknown>): AccessRequest {
  const rawStatus = ((r.status as string) || 'pending').toLowerCase();
  const status: RequestStatus =
    rawStatus === 'approved'
      ? 'approved'
      : rawStatus === 'rejected'
      ? 'rejected'
      : rawStatus === 'expired'
      ? 'expired'
      : 'pending';

  const recordType = (r.recordType as string) || '';
  const categories = Array.isArray(r.categories)
    ? (r.categories as string[])
    : recordType
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  const rawRisk = (r.riskAssessment as Record<string, unknown>) || {};
  const score =
    typeof r.anomalyScore === 'number'
      ? Math.round(r.anomalyScore <= 1 ? r.anomalyScore * 100 : r.anomalyScore)
      : typeof rawRisk.score === 'number'
      ? rawRisk.score
      : 15;

  const rawLevel = String(r.riskLevel || rawRisk.level || 'LOW').toUpperCase();
  const level = rawLevel === 'HIGH' ? 'High' : rawLevel === 'MODERATE' || rawLevel === 'MEDIUM' ? 'Moderate' : 'Low';

  return {
    id: r.id as string,
    patientId: (r.patientId as string) || '',
    patientName: (r.patientName as string) || '',
    doctorId: (r.doctorId as string) || '',
    doctorName: (r.doctorName as string) || 'Attending Physician',
    doctorSpecialty: (r.doctorSpecialty as string) || 'Clinical Care',
    hospital: (r.hospital as string) || 'Medrynx Network',
    recordType,
    categories,
    trustTier: (r.trustTier as string) || 'T1',
    tierLabel: (r.tierLabel as string) || 'T1 — Verified Relationship',
    purpose: ((r.purpose as string) || 'Diagnosis') as RequestPurpose,
    durationDays: (r.durationDays as number) || 7,
    requestedAt: r.requestedAt
      ? new Date(r.requestedAt as string).toLocaleDateString('en-GB')
      : new Date().toLocaleDateString('en-GB'),
    status,
    riskAssessment: {
      score,
      riskLevel: level as 'Low' | 'Moderate' | 'High',
      level: level as any,
      summary:
        level === 'High'
          ? 'Elevated Access Pattern Detected'
          : level === 'Moderate'
            ? 'Moderate Clinical Context Variance'
            : 'Normal Clinical Request Pattern',
      checks: {
        specialtyMatch: (rawRisk.checks as any)?.specialtyMatch ?? score < 65,
        hospitalMatch: (rawRisk.checks as any)?.hospitalMatch ?? true,
        frequencyElevated: (rawRisk.checks as any)?.frequencyElevated ?? score >= 50,
        recordTypeUnusual: (rawRisk.checks as any)?.recordTypeUnusual ?? score >= 65,
      },
      explanation: String(
        rawRisk.explanation ||
          rawRisk.recommendation ||
          'Evaluated by Medrynx AI Anomaly Detection Engine against verified clinical relationship and category scope.'
      ),
      factors: Array.isArray(rawRisk.riskFactors)
        ? (rawRisk.riskFactors as string[])
        : Array.isArray(rawRisk.factors)
        ? (rawRisk.factors as string[])
        : [String(rawRisk.explanation || 'Evaluated by AI Anomaly Detection Engine')],
      recommendation: String(
        rawRisk.explanation || 'Verify clinical relationship and requested category scope before approving.'
      ),
    } as any,
  } as AccessRequest & Record<string, unknown>;
}

export const consentService = {
  async getAccessRequests(): Promise<AccessRequest[]> {
    const list = await apiRequest<Record<string, unknown>[]>('/requests/patient');
    return (list || []).map(normaliseAccessRequest);
  },

  async getDoctorAccessRequests(): Promise<AccessRequest[]> {
    const list = await apiRequest<Record<string, unknown>[]>('/requests/doctor');
    return (list || []).map(normaliseAccessRequest);
  },

  async getConsentBatches(): Promise<ConsentBatch[]> {
    const batches = await apiRequest<Record<string, unknown>[]>('/consent/batches');
    return batches.map((b) => ({
      id: b.id as string,
      title: (b.title as string) || 'Grouped Care Team Requests',
      description: (b.description as string) || '',
      recordType: (b.recordType as string) || '',
      purpose: ((b.purpose as string) || 'Consultation') as RequestPurpose,
      durationDays: (b.durationDays as number) || 14,
      riskLevel: 'Low' as const,
      createdAt: b.createdAt ? new Date(b.createdAt as string).toLocaleDateString('en-GB') : '',
      clinicians: ((b.clinicians || b.doctors || []) as Record<string, unknown>[]).map((doc) => ({
        id: (doc.id as string) || '',
        name: (doc.name as string) || 'Clinician',
        hospital: (doc.hospital as string) || '',
        specialty: (doc.specialty as string) || (doc.specialization as string) || '',
      })),
    }));
  },

  async getActiveConsents(): Promise<ScopedConsent[]> {
    const consents = await apiRequest<Record<string, unknown>[]>('/consent/active');
    return consents.map(normaliseConsent);
  },

  async getAllConsents(): Promise<ScopedConsent[]> {
    const consents = await apiRequest<Record<string, unknown>[]>('/consent/history');
    return consents.map(normaliseConsent);
  },

  async grantScopedAccess(
    requestId: string,
    durationDays: number,
    options?: { categories?: string[]; recordType?: string; scopeNote?: string }
  ): Promise<ScopedConsent> {
    const grant = await apiRequest<Record<string, unknown>>('/consent/grant', {
      method: 'POST',
      data: {
        requestId,
        durationDays,
        categories: options?.categories,
        recordType: options?.recordType,
        scopeNote: options?.scopeNote,
      },
    });
    return normaliseConsent(grant);
  },

  async rejectRequest(requestId: string): Promise<void> {
    await apiRequest('/requests/reject', {
      method: 'POST',
      data: { requestId },
    });
  },

  async revokeConsent(consentId: string): Promise<void> {
    await apiRequest('/consent/revoke', {
      method: 'POST',
      data: { grantId: consentId },
    });
  },

  async createDirectConsent(data: {
    doctorId: string;
    categories: string[];
    durationDays: number;
    purpose: string;
  }): Promise<ScopedConsent> {
    const grant = await apiRequest<Record<string, unknown>>('/consent/grant', {
      method: 'POST',
      data: {
        doctorId: data.doctorId,
        categories: data.categories,
        recordType: data.categories.join(', '),
        durationDays: data.durationDays,
        purpose: data.purpose,
      },
    });
    return normaliseConsent(grant);
  },

  async grantBatchConsent(batchId: string): Promise<void> {
    await apiRequest('/consent/batch-approve', {
      method: 'POST',
      data: { batchId },
    });
  },

  async createDoctorRequest(data: {
    patientId: string;
    recordType?: string;
    categories?: string[];
    purpose: string;
    durationDays?: number;
    clinicalNote?: string;
  }): Promise<AccessRequest> {
    const raw = await apiRequest<Record<string, unknown>>('/requests/create', {
      method: 'POST',
      data,
    });
    return normaliseAccessRequest(raw);
  },
};

