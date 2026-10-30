/**
 * audit.service.ts — Real API integration only. No mock fallbacks.
 */
import { AuditEvent, AuditAccessType } from '../types/audit';
import { apiRequest } from './apiClient';

function mapAccessType(raw: string): AuditAccessType {
  const m: Record<string, AuditAccessType> = {
    EMERGENCY: 'Emergency',
    REVOCATION: 'Revocation',
    DISPUTE: 'Dispute',
    SYSTEM: 'System',
    NORMAL: 'Normal',
  };
  return m[raw?.toUpperCase()] || 'Normal';
}

function mapStatus(raw: string): AuditEvent['status'] {
  const m: Record<string, AuditEvent['status']> = {
    REVIEW_REQUIRED: 'Review Required',
    REVOKED: 'Revoked',
    DISPUTED: 'Disputed',
    COMPLETED: 'Completed',
  };
  return m[raw?.toUpperCase()] || 'Completed';
}

export const auditService = {
  async getAuditLogs(): Promise<AuditEvent[]> {
    const logs = await apiRequest<Array<Record<string, unknown>>>('/audit/logs');
    return logs.map((l) => ({
      id: l.id as string,
      patientId: (l.patientId as string) || '',
      patientName: (l.patientName as string) || '',
      actorId: l.actorId as string,
      actorName: l.actorName as string,
      actorRole: ((l.actorRole as string)?.toLowerCase() as 'doctor' | 'patient' | 'admin' | 'system') || 'doctor',
      hospital: (l.hospital as string) || '',
      recordType: l.recordType as string,
      purpose: l.purpose as string,
      timestamp: new Date(l.timestamp as string).toLocaleString(),
      duration: (l.duration as string) || '',
      accessType: mapAccessType(l.accessType as string),
      status: mapStatus(l.status as string),
      txHash: l.txHash as string | undefined,
    }));
  },

  async getAnalytics(): Promise<unknown> {
    return apiRequest<unknown>('/audit/analytics');
  },

  async verifyAudit(id: string): Promise<{ verified: boolean; blockNumber?: number | null; failureReason?: string }> {
    return apiRequest<{ verified: boolean; blockNumber?: number | null; failureReason?: string }>(`/audit/logs/${id}/verify`);
  },

  async verifyRecordIntegrity(id: string): Promise<Record<string, unknown>> {
    return apiRequest<Record<string, unknown>>(`/records/${id}/integrity`);
  },
};
