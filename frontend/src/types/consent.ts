import { RequestPurpose } from './access';

export interface ScopedConsent {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospital: string;
  recordType: string;
  categories?: string[];
  purpose: RequestPurpose;
  grantedAt: string;
  accessStart: string;
  accessExpiry: string;
  status: 'active' | 'expired' | 'revoked';
  scopeNote: string;
  trustTier?: string;
}

export interface ConsentBatch {
  id: string;
  title: string;
  description: string;
  recordType: string;
  purpose: RequestPurpose;
  durationDays: number;
  clinicians: Array<{
    id: string;
    name: string;
    hospital: string;
    specialty: string;
  }>;
  riskLevel: 'Low';
  createdAt: string;
}
