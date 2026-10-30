export type AuditAccessType = 'Normal' | 'Emergency' | 'System' | 'Revocation' | 'Dispute';

export interface AuditEvent {
  id: string;
  patientId: string;
  patientName: string;
  actorId: string;
  actorName: string;
  actorRole: 'doctor' | 'patient' | 'admin' | 'system';
  hospital?: string;
  recordType: string;
  purpose: string;
  timestamp: string;
  duration: string;
  accessType: AuditAccessType;
  status: 'Completed' | 'Review Required' | 'Revoked' | 'Disputed' | 'Logged';
  ipAddress?: string;
  txHash?: string;
}
