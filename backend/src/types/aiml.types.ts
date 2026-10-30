import { RiskLevel } from '@prisma/client';

export type ModelHealthStatus = 'ok' | 'degraded' | 'unavailable';

export interface AIMLHealthResponse {
  status: ModelHealthStatus;
  modelLoaded: boolean;
  modelVersion?: string | null;
  detail?: string | null;
}

export interface AIMLModelInfoResponse {
  model: string;
  version: string;
  algorithm: string;
  trainedAt?: string | null;
  trainingSamples?: number | null;
  features: string[];
  hyperparameters: Record<string, unknown>;
  riskThresholds: Record<string, unknown>;
  scoreCalibration: Record<string, unknown>;
  dataSource: string;
}

export interface AIMLFeaturePayload {
  doctor_specialty: string;
  record_type: string;
  purpose: string;
  hospital_affiliation: string;
  requests_last_24h: number;
  requests_last_7d: number;
  requests_for_record_type: number;
  average_daily_requests: number;
  request_hour: number;
  emergency_flag: number;
}

export interface AIMLRawPredictionResponse {
  anomaly_score: number;
  anomaly_flag: boolean;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
  decision_score: number;
  model_version: string;
}

export interface AIMLSimulationRequest {
  doctorSpecialty: string;
  recordType: string;
  purpose: string;
  hospital?: string;
  requestsLast24h?: number;
  requestsLast7d?: number;
  requestsForRecordType?: number;
  averageDailyRequests?: number;
  requestHour?: number;
  isEmergency?: boolean;
}

export interface AIMLAnomalyFilterParams {
  riskLevel?: RiskLevel | string;
  isFlagged?: boolean;
  doctorId?: string;
  patientId?: string;
  limit?: number;
  offset?: number;
}

export interface AIMLAnomalyItem {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospital: string;
  recordType: string;
  purpose: string;
  durationDays: number;
  anomalyScore: number;
  riskLevel: RiskLevel | string;
  isFlagged: boolean;
  status: string;
  reasons: string[];
  requestedAt: Date | string;
  riskAssessment?: Record<string, unknown>;
}

export interface AIMLSummaryMetrics {
  totalEvaluated: number;
  highRiskCount: number;
  moderateRiskCount: number;
  lowRiskCount: number;
  flaggedCount: number;
  averageScore: number;
  modelHealth: AIMLHealthResponse;
}
