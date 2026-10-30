export type RequestPurpose = 
  | 'Diagnosis' 
  | 'Routine Follow-up' 
  | 'Second Opinion' 
  | 'Surgical Prep' 
  | 'Emergency Treatment' 
  | 'Prescription Renewal';

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';

export interface AnomalyAssessment {
  score: number; // 0 - 100
  riskLevel: RiskLevel;
  summary: string;
  checks: {
    specialtyMatch: boolean;
    hospitalMatch: boolean;
    frequencyElevated: boolean;
    recordTypeUnusual: boolean;
    timeWindowDeviated: boolean;
  };
  explanation: string;
}

export interface AccessRequest {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospital: string;
  recordType: string;
  purpose: RequestPurpose;
  durationDays: number;
  requestedAt: string;
  accessStart?: string;
  accessExpiry?: string;
  riskAssessment: AnomalyAssessment;
  status: RequestStatus;
  isBatched?: boolean;
  batchId?: string;
}
