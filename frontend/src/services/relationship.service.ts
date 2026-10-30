/**
 * relationship.service.ts — Real API integration only. No mock fallbacks.
 */
import { apiRequest } from './apiClient';

export type RelationshipType =
  | 'PATIENT_PROVIDER'
  | 'PATIENT_CARE_TEAM'
  | 'PATIENT_ORGANIZATION'
  | 'PROVIDER_ORGANIZATION';

export type RelationshipStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED' | 'EXPIRED';
export type TrustTier = 'T0' | 'T1' | 'T2' | 'T3';

export interface TrustRelationship {
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
  trustTier?: TrustTier;
  tierLabel?: string;
  createdAt: string;
  updatedAt: string;
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

export interface DoctorDirectoryEntry {
  id: string;
  doctorId: string;
  name: string;
  email: string;
  specialization: string;
  hospital: string;
  licenseId?: string;
}

export const relationshipService = {
  async getRelationships(status?: RelationshipStatus): Promise<TrustRelationship[]> {
    const url = status ? `/relationships?status=${status}` : '/relationships';
    return apiRequest<TrustRelationship[]>(url);
  },

  async getDoctorsDirectory(): Promise<DoctorDirectoryEntry[]> {
    return apiRequest<DoctorDirectoryEntry[]>('/relationships/doctors');
  },

  async getPatientDirectory(): Promise<DoctorPatientDirectoryEntry[]> {
    return apiRequest<DoctorPatientDirectoryEntry[]>('/relationships/patients');
  },

  async evaluateTrust(patientId: string): Promise<DoctorPatientDirectoryEntry> {
    return apiRequest<DoctorPatientDirectoryEntry>(`/relationships/evaluate/${patientId}`);
  },

  async getRelationshipById(id: string): Promise<TrustRelationship> {
    return apiRequest<TrustRelationship>(`/relationships/${id}`);
  },

  async createRelationship(input: {
    relationshipType: RelationshipType;
    targetId: string;
    organizationId?: string;
    notes?: string;
    durationDays?: number;
  }): Promise<TrustRelationship> {
    return apiRequest<TrustRelationship>('/relationships', {
      method: 'POST',
      data: input,
    });
  },

  async acceptRelationship(id: string): Promise<TrustRelationship> {
    return apiRequest<TrustRelationship>(`/relationships/${id}/accept`, { method: 'PATCH' });
  },

  async transitionRelationship(
    id: string,
    relationshipType: RelationshipType
  ): Promise<TrustRelationship> {
    return apiRequest<TrustRelationship>(`/relationships/${id}/transition`, {
      method: 'PATCH',
      data: { relationshipType },
    });
  },

  async rejectRelationship(id: string): Promise<TrustRelationship> {
    return apiRequest<TrustRelationship>(`/relationships/${id}/reject`, { method: 'PATCH' });
  },

  async revokeRelationship(id: string): Promise<TrustRelationship> {
    return apiRequest<TrustRelationship>(`/relationships/${id}/revoke`, { method: 'PATCH' });
  },
};

