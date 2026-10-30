import { apiRequest } from './apiClient';

export interface AIMLHealthStatus {
  status: 'ok' | 'degraded' | 'unavailable';
  modelLoaded: boolean;
  modelVersion?: string | null;
  detail?: string | null;
}

export interface AIMLModelInfo {
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
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | string;
  isFlagged: boolean;
  status: string;
  reasons: string[];
  requestedAt: string;
  riskAssessment?: {
    specialtyMatch?: boolean;
    withinOperatingHours?: boolean;
    networkAffiliated?: boolean;
    explanation?: string;
    riskFactors?: string[];
  };
}

export interface AIMLSummaryMetrics {
  totalEvaluated: number;
  highRiskCount: number;
  moderateRiskCount: number;
  lowRiskCount: number;
  flaggedCount: number;
  averageScore: number;
  modelHealth: AIMLHealthStatus;
}

export interface AIMLSimulationInput {
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

export interface AIMLSimulationResult {
  anomalyScore: number;
  rawScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  isFlagged: boolean;
  reasons: string[];
  decisionScore: number;
  modelVersion: string;
  riskAssessment: {
    score: number;
    riskLevel: string;
    specialtyMatch: boolean;
    withinOperatingHours: boolean;
    networkAffiliated: boolean;
    explanation: string;
    riskFactors: string[];
  };
}

export const aimlService = {
  async getHealth(): Promise<AIMLHealthStatus> {
    try {
      return await apiRequest<AIMLHealthStatus>('/aiml/health');
    } catch (err) {
      return {
        status: 'unavailable',
        modelLoaded: false,
        detail: err instanceof Error ? err.message : 'AI/ML service unreachable',
      };
    }
  },

  async getModelInfo(): Promise<AIMLModelInfo> {
    return apiRequest<AIMLModelInfo>('/aiml/model-info');
  },

  async getAnomalies(filters?: {
    riskLevel?: string;
    isFlagged?: boolean;
    doctorId?: string;
    patientId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AIMLAnomalyItem[]> {
    const params = new URLSearchParams();
    if (filters?.riskLevel && filters.riskLevel !== 'ALL') {
      params.append('riskLevel', filters.riskLevel);
    }
    if (filters?.isFlagged !== undefined) {
      params.append('isFlagged', String(filters.isFlagged));
    }
    if (filters?.doctorId) {
      params.append('doctorId', filters.doctorId);
    }
    if (filters?.patientId) {
      params.append('patientId', filters.patientId);
    }
    if (filters?.limit) {
      params.append('limit', String(filters.limit));
    }
    if (filters?.offset) {
      params.append('offset', String(filters.offset));
    }

    const query = params.toString();
    const endpoint = `/aiml/anomalies${query ? `?${query}` : ''}`;
    return apiRequest<AIMLAnomalyItem[]>(endpoint);
  },

  async getSummary(): Promise<AIMLSummaryMetrics> {
    return apiRequest<AIMLSummaryMetrics>('/aiml/summary');
  },

  async simulateScore(data: AIMLSimulationInput): Promise<AIMLSimulationResult> {
    return apiRequest<AIMLSimulationResult>('/aiml/simulate', {
      method: 'POST',
      data,
    });
  },
};
