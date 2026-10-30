export type EmergencyAccessLevel = 'Partial' | 'Full';

export interface EmergencyEvent {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  hospital: string;
  accessLevel: EmergencyAccessLevel;
  recordsAccessed: string[];
  requestedAt: string;
  durationMinutes: number;
  reason: string;
  emergencyCode?: string;
  hospitalVerified: boolean;
  reconciliationStatus: 'pending' | 'acknowledged' | 'disputed';
  disputeId?: string;
  onChainTxHash?: string;
  accessWindowStart?: string;
  autoRevokeTimestamp?: string;
  patientHumanId?: string;
  patientEmail?: string;
}

export interface EmergencyBreakGlassPayload {
  patientId: string;
  accessLevel: EmergencyAccessLevel;
  reason: string;
  emergencyCode?: string;
}
