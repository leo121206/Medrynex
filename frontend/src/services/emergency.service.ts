/**
 * emergency.service.ts — Real API integration only. No mock fallbacks.
 */
import { EmergencyEvent, EmergencyBreakGlassPayload } from '../types/emergency';
import { apiRequest } from './apiClient';

function normaliseEvent(e: Record<string, unknown>): EmergencyEvent {
  return {
    id: e.id as string,
    patientId: (e.patientId as string) || '',
    patientHumanId: (e.patientHumanId as string) || undefined,
    patientName: (e.patientName as string) || '',
    patientEmail: (e.patientEmail as string) || undefined,
    doctorId: (e.doctorId as string) || '',
    doctorName: (e.doctorName as string) || '',
    hospital: (e.hospital as string) || '',
    accessLevel: (e.verificationTier === 'FULL' ? 'Full' : 'Partial') as 'Full' | 'Partial',
    recordsAccessed: (e.recordsAccessed as string[]) || [],
    requestedAt: e.accessWindowStart
      ? new Date(e.accessWindowStart as string).toLocaleString()
      : e.createdAt
        ? new Date(e.createdAt as string).toLocaleString()
        : '',
    accessWindowStart: (e.accessWindowStart as string) || undefined,
    autoRevokeTimestamp: (e.autoRevokeTimestamp as string) || undefined,
    durationMinutes: (e.durationMinutes as number) || 15,
    reason: (e.reason as string) || '',
    emergencyCode: (e.emergencyCode as string) || '',
    hospitalVerified: (e.hospitalVerified as boolean) ?? true,
    reconciliationStatus:
      ((e.reconciliationStatus as string)?.toLowerCase() as 'pending' | 'acknowledged' | 'disputed') || 'pending',
    onChainTxHash: e.onChainTxHash as string | undefined,
  };
}

export const emergencyService = {
  async getEmergencyEvents(): Promise<EmergencyEvent[]> {
    const result = await apiRequest<Record<string, unknown>[]>('/emergency/history');
    return result.map(normaliseEvent);
  },

  async getActiveEmergencies(): Promise<EmergencyEvent[]> {
    const result = await apiRequest<Record<string, unknown>[]>('/emergency/active');
    return result.map(normaliseEvent);
  },

  async triggerEmergencyAccess(payload: EmergencyBreakGlassPayload): Promise<EmergencyEvent> {
    const result = await apiRequest<Record<string, unknown>>('/emergency/declare', {
      method: 'POST',
      data: {
        patientId: payload.patientId,
        tier: payload.accessLevel === 'Full' ? 'FULL' : 'PARTIAL',
        reason: payload.reason,
        emergencyCode: payload.emergencyCode,
      },
    });
    return normaliseEvent(result);
  },

  async revokeEmergencyAccess(eventId: string): Promise<void> {
    await apiRequest('/emergency/revoke', {
      method: 'POST',
      data: { emergencyId: eventId },
    });
  },

  async acknowledgeEmergencyAccess(eventId: string): Promise<void> {
    await apiRequest('/emergency/reconcile', {
      method: 'POST',
      data: { emergencyId: eventId },
    });
  },
};
