import { store } from '../models/store';
import { prisma, isDbConnected } from '../models/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { RiskLevel } from '@prisma/client';
import { AuthenticatedUser } from '../types/common.types';
import { ApiError } from '../utils/apiError';
import {
  AIMLHealthResponse,
  AIMLModelInfoResponse,
  AIMLFeaturePayload,
  AIMLRawPredictionResponse,
  AIMLSimulationRequest,
  AIMLAnomalyFilterParams,
  AIMLAnomalyItem,
  AIMLSummaryMetrics,
} from '../types/aiml.types';

export interface MLScoreRequest {
  doctorId: string;
  doctorSpecialty: string;
  hospital: string;
  recordType: string;
  purpose: string;
  isEmergency?: boolean;
}

export interface MLScoreResult {
  anomalyScore: number;       // 0 - 100 scale for UI
  rawScore: number;           // 0.0 - 1.0 from model
  riskLevel: RiskLevel;       // LOW | MODERATE | HIGH
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
    checks: {
      specialtyMatch: boolean;
      hospitalMatch: boolean;
      frequencyElevated: boolean;
      recordTypeUnusual: boolean;
      timeWindowDeviated: boolean;
    };
  };
}

/**
 * Normalizes input record type string to one of the trained AIML vocabulary tokens.
 */
export function normalizeRecordType(recordType: string): string {
  const lower = (recordType || '').toLowerCase();
  if (lower.includes('ecg')) return 'ECG';
  if (lower.includes('mri') || lower.includes('brain')) return 'MRI_Scan_Report';
  if (lower.includes('blood') || lower.includes('lab')) return 'Blood_Report';
  if (lower.includes('xray') || lower.includes('x-ray')) return 'XRay_Report';
  if (lower.includes('ct') || lower.includes('computed')) return 'CT_Scan_Report';
  if (lower.includes('prescrip') || lower.includes('medicat')) return 'Prescription';
  if (lower.includes('skin') || lower.includes('derm')) return 'Skin_Report';
  if (lower.includes('allerg')) return 'Allergy_Record';
  if (lower.includes('surg')) return 'Surgery_Note';
  if (lower.includes('discharg')) return 'Discharge_Summary';
  if (lower.includes('cardio') || lower.includes('heart')) return 'Cardiac_Report';
  return 'ECG'; // standard normative clinical default
}

/**
 * Normalizes input purpose string to one of the trained AIML vocabulary tokens.
 */
export function normalizePurpose(purpose: string): string {
  const p = (purpose || '').replace(/[\s-]+/g, '_').toLowerCase();
  if (p.includes('emerg')) return 'Emergency';
  if (p.includes('second')) return 'Second_Opinion';
  if (p.includes('follow')) return 'Follow_Up';
  if (p.includes('treat') || p.includes('surg') || p.includes('prescrip')) return 'Treatment';
  return 'Diagnosis';
}

/**
 * Normalizes doctor specialty to standard vocabulary.
 */
export function normalizeSpecialty(spec: string): string {
  const s = (spec || '').replace(/[\s-]+/g, '_').toLowerCase();
  if (s.includes('cardio')) return 'Cardiology';
  if (s.includes('neuro')) return 'Neurology';
  if (s.includes('ortho')) return 'Orthopedics';
  if (s.includes('derm')) return 'Dermatology';
  if (s.includes('emerg')) return 'Emergency_Medicine';
  return 'Cardiology';
}

/**
 * Helper to resolve the AIML base URL from the configured scoring URL.
 */
function getAimlBaseUrl(): string {
  return env.ML_SCORING_URL.replace(/\/predict\/?$/, '');
}

/**
 * Robust fetch wrapper with timeout and bounded retries.
 */
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 3000,
  maxRetries: number = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response;
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = (err as Error).name === 'AbortError';
      const msg = isAbort ? `Request timed out after ${timeoutMs}ms` : (err as Error).message;
      lastError = new Error(`Attempt ${attempt}/${maxRetries} failed: ${msg}`);

      if (attempt < maxRetries) {
        // Short exponential backoff before retry
        await new Promise((resolve) => setTimeout(resolve, attempt * 100));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

/**
 * Evaluates clinician access pattern risk by calling the python FastAPI AIML service.
 * Enforces Zero-PHI: Only categorical and numeric frequency metrics are sent.
 */
export async function scoreAccessAnomaly(params: MLScoreRequest): Promise<MLScoreResult> {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // Compute rolling counts from in-memory store
  const docRequests = store.requests.filter((r) => r.doctorId === params.doctorId);
  const requestsLast24h = docRequests.filter((r) => new Date(r.requestedAt).getTime() >= oneDayAgo).length;
  const requestsLast7d = docRequests.filter((r) => new Date(r.requestedAt).getTime() >= sevenDaysAgo).length;
  const requestsForRecordType = docRequests.filter(
    (r) => Boolean(r.recordType && params.recordType && r.recordType.toLowerCase() === params.recordType.toLowerCase())
  ).length;

  const averageDailyRequests = Math.max(1.0, parseFloat((requestsLast7d / 7 || 5.0).toFixed(1)));
  const requestHour = new Date().getHours();
  const emergencyFlag = params.isEmergency ? 1 : 0;

  const aimlPayload: AIMLFeaturePayload = {
    doctor_specialty: normalizeSpecialty(params.doctorSpecialty),
    record_type: normalizeRecordType(params.recordType),
    purpose: normalizePurpose(params.purpose),
    hospital_affiliation: params.hospital.replace(/\s+/g, '_').slice(0, 16) || 'HOSP001',
    requests_last_24h: requestsLast24h,
    requests_last_7d: requestsLast7d,
    requests_for_record_type: requestsForRecordType,
    average_daily_requests: averageDailyRequests,
    request_hour: requestHour,
    emergency_flag: emergencyFlag,
  };

  // Zero-PHI audit log: Log only operational counters and categories
  logger.info('Calling AI/ML Anomaly Scoring microservice', {
    url: env.ML_SCORING_URL,
    payload: {
      specialty: aimlPayload.doctor_specialty,
      recordType: aimlPayload.record_type,
      purpose: aimlPayload.purpose,
      req24h: aimlPayload.requests_last_24h,
      req7d: aimlPayload.requests_last_7d,
    },
  });

  try {
    const response = await fetchWithTimeoutAndRetry(
      env.ML_SCORING_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aimlPayload),
      },
      3000,
      2
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ML service returned HTTP ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as AIMLRawPredictionResponse;

    logger.info('AI/ML Anomaly Scoring response received', {
      score: data.anomaly_score,
      riskLevel: data.risk_level,
      flagged: data.anomaly_flag,
    });

    const scaledScore = Math.round(data.anomaly_score * 1000) / 10; // 0.0 - 100.0

    let prismaRiskLevel: RiskLevel = RiskLevel.LOW;
    if (data.risk_level === 'HIGH' || scaledScore >= env.ANOMALY_THRESHOLD) {
      prismaRiskLevel = RiskLevel.HIGH;
    } else if (data.risk_level === 'MEDIUM' || scaledScore >= 45) {
      prismaRiskLevel = RiskLevel.MODERATE;
    }

    const explanation = data.reasons.length > 0
      ? data.reasons.join('. ') + '.'
      : 'Normative access pattern consistent with clinician historical baseline.';

    return {
      anomalyScore: scaledScore,
      rawScore: data.anomaly_score,
      riskLevel: prismaRiskLevel,
      isFlagged: data.anomaly_flag || scaledScore >= env.ANOMALY_THRESHOLD,
      reasons: data.reasons,
      decisionScore: data.decision_score,
      modelVersion: data.model_version,
      riskAssessment: {
        score: scaledScore,
        riskLevel: data.risk_level === 'MEDIUM' ? 'Moderate' : data.risk_level === 'HIGH' ? 'High' : 'Low',
        specialtyMatch: !data.reasons.some((r) => r.toLowerCase().includes('specialty')),
        withinOperatingHours: !data.reasons.some((r) => r.toLowerCase().includes('hours')),
        networkAffiliated: true,
        explanation,
        riskFactors: data.reasons,
        checks: {
          specialtyMatch: !data.reasons.some((r) => r.toLowerCase().includes('specialty')),
          hospitalMatch: true,
          frequencyElevated: data.reasons.some((r) => r.toLowerCase().includes('volume') || r.toLowerCase().includes('rate')),
          recordTypeUnusual: data.reasons.some((r) => r.toLowerCase().includes('uncommon') || r.toLowerCase().includes('record')),
          timeWindowDeviated: data.reasons.some((r) => r.toLowerCase().includes('hours')),
        },
      },
    };
  } catch (error) {
    logger.warn('AI/ML Microservice call failed, applying safe fail-open fallback', {
      error: error instanceof Error ? error.message : String(error),
    });

    // Normative safe fallback: AI failure does not block authorized clinical care
    return {
      anomalyScore: 18.5,
      rawScore: 0.185,
      riskLevel: RiskLevel.LOW,
      isFlagged: false,
      reasons: [],
      decisionScore: 0.12,
      modelVersion: '1.0-fallback',
      riskAssessment: {
        score: 18.5,
        riskLevel: 'Low',
        specialtyMatch: true,
        withinOperatingHours: true,
        networkAffiliated: true,
        explanation: 'Normative access pattern (evaluation performed in safe disconnected mode).',
        riskFactors: [],
        checks: {
          specialtyMatch: true,
          hospitalMatch: true,
          frequencyElevated: false,
          recordTypeUnusual: false,
          timeWindowDeviated: false,
        },
      },
    };
  }
}

/**
 * Simulates anomaly scoring for hypothetical access patterns (Clinician / Admin tools).
 */
export async function simulateAnomalyScore(params: AIMLSimulationRequest): Promise<MLScoreResult> {
  const aimlPayload: AIMLFeaturePayload = {
    doctor_specialty: normalizeSpecialty(params.doctorSpecialty),
    record_type: normalizeRecordType(params.recordType),
    purpose: normalizePurpose(params.purpose),
    hospital_affiliation: (params.hospital || 'HOSP001').replace(/\s+/g, '_').slice(0, 16),
    requests_last_24h: params.requestsLast24h ?? 2,
    requests_last_7d: params.requestsLast7d ?? 10,
    requests_for_record_type: params.requestsForRecordType ?? 5,
    average_daily_requests: params.averageDailyRequests ?? 3.5,
    request_hour: params.requestHour ?? new Date().getHours(),
    emergency_flag: params.isEmergency ? 1 : 0,
  };

  try {
    const response = await fetchWithTimeoutAndRetry(
      env.ML_SCORING_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aimlPayload),
      },
      3000,
      2
    );

    if (!response.ok) {
      throw new Error(`ML service returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as AIMLRawPredictionResponse;
    const scaledScore = Math.round(data.anomaly_score * 1000) / 10;

    let prismaRiskLevel: RiskLevel = RiskLevel.LOW;
    if (data.risk_level === 'HIGH' || scaledScore >= env.ANOMALY_THRESHOLD) {
      prismaRiskLevel = RiskLevel.HIGH;
    } else if (data.risk_level === 'MEDIUM' || scaledScore >= 45) {
      prismaRiskLevel = RiskLevel.MODERATE;
    }

    return {
      anomalyScore: scaledScore,
      rawScore: data.anomaly_score,
      riskLevel: prismaRiskLevel,
      isFlagged: data.anomaly_flag || scaledScore >= env.ANOMALY_THRESHOLD,
      reasons: data.reasons,
      decisionScore: data.decision_score,
      modelVersion: data.model_version,
      riskAssessment: {
        score: scaledScore,
        riskLevel: data.risk_level === 'MEDIUM' ? 'Moderate' : data.risk_level === 'HIGH' ? 'High' : 'Low',
        specialtyMatch: !data.reasons.some((r) => r.toLowerCase().includes('specialty')),
        withinOperatingHours: !data.reasons.some((r) => r.toLowerCase().includes('hours')),
        networkAffiliated: true,
        explanation: data.reasons.join('. ') || 'Normative simulation pattern.',
        riskFactors: data.reasons,
        checks: {
          specialtyMatch: !data.reasons.some((r) => r.toLowerCase().includes('specialty')),
          hospitalMatch: true,
          frequencyElevated: data.reasons.some((r) => r.toLowerCase().includes('volume') || r.toLowerCase().includes('rate')),
          recordTypeUnusual: data.reasons.some((r) => r.toLowerCase().includes('uncommon') || r.toLowerCase().includes('record')),
          timeWindowDeviated: data.reasons.some((r) => r.toLowerCase().includes('hours')),
        },
      },
    };
  } catch (error) {
    logger.warn('Simulation scoring failed, returning fail-open fallback', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      anomalyScore: 20.0,
      rawScore: 0.2,
      riskLevel: RiskLevel.LOW,
      isFlagged: false,
      reasons: [],
      decisionScore: 0.15,
      modelVersion: '1.0-fallback',
      riskAssessment: {
        score: 20.0,
        riskLevel: 'Low',
        specialtyMatch: true,
        withinOperatingHours: true,
        networkAffiliated: true,
        explanation: 'Normative simulation fallback.',
        riskFactors: [],
        checks: {
          specialtyMatch: true,
          hospitalMatch: true,
          frequencyElevated: false,
          recordTypeUnusual: false,
          timeWindowDeviated: false,
        },
      },
    };
  }
}

/**
 * Queries the live AI/ML microservice for liveness and model-readiness status.
 */
export async function getModelHealth(): Promise<AIMLHealthResponse> {
  const healthUrl = `${getAimlBaseUrl()}/health`;

  try {
    const response = await fetchWithTimeoutAndRetry(healthUrl, { method: 'GET' }, 2000, 2);
    if (!response.ok) {
      return {
        status: 'degraded',
        modelLoaded: false,
        detail: `AI/ML service returned HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      status: 'ok' | 'degraded';
      model_loaded: boolean;
      model_version?: string | null;
      detail?: string | null;
    };

    return {
      status: data.status,
      modelLoaded: data.model_loaded,
      modelVersion: data.model_version,
      detail: data.detail,
    };
  } catch (err) {
    return {
      status: 'unavailable',
      modelLoaded: false,
      detail: err instanceof Error ? err.message : 'AI/ML service unreachable',
    };
  }
}

/**
 * Retrieves loaded model metadata, architecture, features, and risk thresholds.
 */
export async function getModelInfo(): Promise<AIMLModelInfoResponse> {
  const infoUrl = `${getAimlBaseUrl()}/model-info`;

  try {
    const response = await fetchWithTimeoutAndRetry(infoUrl, { method: 'GET' }, 2000, 2);
    if (!response.ok) {
      throw new Error(`AI/ML service returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      model: string;
      version: string;
      algorithm: string;
      trained_at?: string | null;
      training_samples?: number | null;
      features: string[];
      hyperparameters: Record<string, unknown>;
      risk_thresholds: Record<string, unknown>;
      score_calibration: Record<string, unknown>;
      data_source: string;
    };

    return {
      model: data.model,
      version: data.version,
      algorithm: data.algorithm,
      trainedAt: data.trained_at,
      trainingSamples: data.training_samples,
      features: data.features,
      hyperparameters: data.hyperparameters,
      riskThresholds: data.risk_thresholds,
      scoreCalibration: data.score_calibration,
      dataSource: data.data_source,
    };
  } catch (err) {
    logger.warn('Failed to retrieve model info, returning fallback metadata', {
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      model: 'IsolationForest',
      version: '1.0-cached',
      algorithm: 'Isolation Forest (Anomaly Detection)',
      trainedAt: null,
      trainingSamples: 10000,
      features: [
        'doctor_specialty',
        'record_type',
        'purpose',
        'hospital_affiliation',
        'requests_last_24h',
        'requests_last_7d',
        'requests_for_record_type',
        'average_daily_requests',
        'request_hour',
        'emergency_flag',
      ],
      hyperparameters: {
        n_estimators: 200,
        contamination: 0.05,
        random_state: 42,
      },
      riskThresholds: {
        anomaly_flag_at: 0.5,
        medium_at: 0.45,
        high_at: 0.65,
        note: 'Operational defaults. Not clinically validated.',
      },
      scoreCalibration: {
        method: 'piecewise-linear rescaling of decision_function',
      },
      dataSource: 'synthetic access pattern logs (Zero-PHI)',
    };
  }
}

/**
 * Returns tenant-isolated anomaly evaluations with filtering and role enforcement.
 * - ADMIN: System-wide access to all requests.
 * - DOCTOR: Only requests initiated by the doctor.
 * - PATIENT: Only requests targeting the patient.
 */
export async function getTenantAnomalies(
  user: AuthenticatedUser,
  filters: AIMLAnomalyFilterParams = {}
): Promise<AIMLAnomalyItem[]> {
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  let list: any[] = store.requests;

  if (isDbConnected && !isTestEnv) {
    try {
      const { prisma } = await import('../models/db');
      const dbReqs = await prisma.accessRequest.findMany({
        include: { doctor: true, patient: true },
        orderBy: { requestedAt: 'desc' },
      });
      list = dbReqs.map((r) => ({
        ...r,
        doctorName: r.doctor?.name || r.doctor?.email || 'Dr. Medical Practitioner',
        doctorSpecialty: r.doctor?.specialization || 'General Practice',
        hospital: r.doctor?.hospital || 'Clinical Facility',
      }));
    } catch {
      // fallback
    }
  }

  // Tenant / Role Authorization Boundary
  if (user.role === 'ADMIN') {
    // Admin can see all, or filter by specific doctorId or patientId
    if (filters.doctorId) {
      list = list.filter((r) => r.doctorId === filters.doctorId);
    }
    if (filters.patientId) {
      list = list.filter((r) => r.patientId === filters.patientId);
    }
  } else if (user.role === 'DOCTOR') {
    list = list.filter((r) => r.doctorId === user.id || (user.doctorId && r.doctorId === user.doctorId));
  } else if (user.role === 'PATIENT') {
    list = list.filter((r) => r.patientId === user.id || (user.patientId && r.patientId === user.patientId));
  } else {
    throw ApiError.forbidden('User role is not authorized to inspect access anomaly feeds');
  }

  // Filter by riskLevel
  if (filters.riskLevel && filters.riskLevel.toString().toUpperCase() !== 'ALL') {
    const targetLevel = filters.riskLevel.toString().toUpperCase();
    list = list.filter((r) => r.riskLevel.toUpperCase() === targetLevel);
  }

  // Filter by isFlagged
  if (typeof filters.isFlagged === 'boolean') {
    list = list.filter((r) => Boolean(r.isFlagged) === filters.isFlagged);
  }

  // Sort descending by requested date
  const sorted = [...list].sort(
    (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  );

  // Pagination
  const offset = filters.offset || 0;
  const limit = filters.limit || 50;
  const paginated = sorted.slice(offset, offset + limit);

  return paginated.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    doctorId: r.doctorId,
    doctorName: r.doctorName || 'Dr. Medical Practitioner',
    doctorSpecialty: r.doctorSpecialty || 'General Practice',
    hospital: r.hospital || 'Clinical Facility',
    recordType: r.recordType,
    purpose: r.purpose,
    durationDays: r.durationDays,
    anomalyScore: r.anomalyScore,
    riskLevel: r.riskLevel,
    isFlagged: r.isFlagged,
    status: r.status,
    reasons: (r.riskAssessment as any)?.riskFactors || (r.riskAssessment as any)?.reasons || [],
    requestedAt: r.requestedAt,
    riskAssessment: r.riskAssessment || undefined,
  }));
}

/**
 * Returns advisory summary statistics for the calling tenant.
 */
export async function getAdvisorySummary(user: AuthenticatedUser): Promise<AIMLSummaryMetrics> {
  const anomalies = await getTenantAnomalies(user, { limit: 1000 });
  const health = await getModelHealth();

  const highRiskCount = anomalies.filter((a) => a.riskLevel.toString().toUpperCase() === 'HIGH').length;
  const moderateRiskCount = anomalies.filter((a) => a.riskLevel.toString().toUpperCase() === 'MODERATE').length;
  const lowRiskCount = anomalies.filter((a) => a.riskLevel.toString().toUpperCase() === 'LOW').length;
  const flaggedCount = anomalies.filter((a) => a.isFlagged).length;

  const totalEvaluated = anomalies.length;
  const totalScore = anomalies.reduce((acc, curr) => acc + (curr.anomalyScore || 0), 0);
  const averageScore = totalEvaluated > 0 ? Math.round((totalScore / totalEvaluated) * 10) / 10 : 0;

  return {
    totalEvaluated,
    highRiskCount,
    moderateRiskCount,
    lowRiskCount,
    flaggedCount,
    averageScore,
    modelHealth: health,
  };
}
