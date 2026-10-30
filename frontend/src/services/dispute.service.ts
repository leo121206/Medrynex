/**
 * dispute.service.ts — Real API integration only. No mock fallbacks.
 */
import { Dispute, DisputeReason } from '../types/dispute';
import { apiRequest } from './apiClient';

function normaliseDispute(d: Record<string, unknown>): Dispute {
  const fmt = (v: unknown) =>
    v ? new Date(v as string).toLocaleDateString('en-GB') : '—';
  const statusMap: Record<string, string> = {
    OPEN: 'Open',
    RESOLVED: 'Resolved',
    UNDER_REVIEW: 'Under Review',
  };
  return {
    id: d.id as string,
    patientId: (d.patientId as string) || '',
    patientName: (d.patientName as string) || '',
    eventId: (d.emergencyEventId || d.eventId) as string,
    doctorName: (d.doctorName as string) || '',
    hospital: (d.hospital as string) || '',
    accessDate: fmt(d.createdAt),
    reason: d.reason as DisputeReason,
    details: (d.details as string) || '',
    attachedDocName: d.attachedDocName as string | undefined,
    status: (statusMap[(d.status as string)?.toUpperCase()] || d.status) as Dispute['status'],
    onChainTxHash: d.onChainTxHash as string | undefined,
    createdAt: fmt(d.createdAt),
    updatedAt: fmt(d.updatedAt),
  };
}

export const disputeService = {
  async getDisputes(): Promise<Dispute[]> {
    const result = await apiRequest<Record<string, unknown>[]>('/emergency/disputes');
    return result.map(normaliseDispute);
  },

  async submitDispute(data: {
    eventId: string;
    doctorName: string;
    hospital: string;
    reason: DisputeReason;
    details: string;
    file?: File | null;
  }): Promise<Dispute> {
    const result = await apiRequest<Record<string, unknown>>('/emergency/dispute', {
      method: 'POST',
      data: {
        emergencyEventId: data.eventId,
        reason: data.reason.replace(/\s+/g, '_'),
        details: data.details,
      },
    });
    return normaliseDispute({ ...result, doctorName: data.doctorName, hospital: data.hospital });
  },
};
