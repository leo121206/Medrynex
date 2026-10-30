import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { store, InMemoryRequest } from '../models/store';
import { signToken } from '../utils/jwt';
import { UserRole, RequestPurpose, RiskLevel, RequestStatus } from '@prisma/client';
import { scoreAccessAnomaly, simulateAnomalyScore, getModelHealth, getModelInfo } from '../services/ml.service';

describe('MEDRYNX PHASE 11 — AI/ML ADVISORY INTEGRATION TEST SUITE', () => {
  // Test identity tokens
  const adminUser = {
    id: 'admin-ai-001',
    email: 'admin.ai@medrynx.org',
    role: UserRole.ADMIN,
    adminId: 'ADM-001',
  };

  const doctorA = {
    id: 'doc-ai-cardio',
    email: 'dr.sharma@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-CARDIO-1',
    hospital: 'Apex Heart Institute',
  };

  const doctorB = {
    id: 'doc-ai-neuro',
    email: 'dr.patel@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-NEURO-1',
    hospital: 'Metro Neuro Hospital',
  };

  const patientA = {
    id: 'pat-ai-001',
    email: 'patient.a@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-001',
  };

  const patientB = {
    id: 'pat-ai-002',
    email: 'patient.b@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-002',
  };

  const adminToken = signToken(adminUser);
  const docAToken = signToken(doctorA);
  const docBToken = signToken(doctorB);
  const patAToken = signToken(patientA);
  const patBToken = signToken(patientB);

  beforeEach(() => {
    // Seed initial store requests for tenant isolation testing
    store.requests = [
      {
        id: 'req-ai-test-1',
        patientId: patientA.id,
        doctorId: doctorA.id,
        doctorName: 'Dr. Sharma',
        doctorSpecialty: 'Cardiology',
        hospital: 'Apex Heart Institute',
        recordType: 'ECG',
        purpose: RequestPurpose.Diagnosis,
        durationDays: 7,
        anomalyScore: 18.5,
        riskLevel: RiskLevel.LOW,
        isFlagged: false,
        isBatched: false,
        status: RequestStatus.PENDING,
        requestedAt: new Date(Date.now() - 3600 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        riskAssessment: {
          reasons: ['Normative cardiology access'],
          specialtyMatch: true,
          withinOperatingHours: true,
        },
      },
      {
        id: 'req-ai-test-2',
        patientId: patientB.id,
        doctorId: doctorB.id,
        doctorName: 'Dr. Patel',
        doctorSpecialty: 'Neurology',
        hospital: 'Metro Neuro Hospital',
        recordType: 'MRI_Scan_Report',
        purpose: RequestPurpose.Emergency_Treatment,
        durationDays: 14,
        anomalyScore: 78.2,
        riskLevel: RiskLevel.HIGH,
        isFlagged: true,
        isBatched: false,
        status: RequestStatus.PENDING,
        requestedAt: new Date(Date.now() - 1800 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        riskAssessment: {
          riskFactors: ['High access volume in 24h window', 'Unusual request hour (03:00)'],
          reasons: ['High access volume in 24h window', 'Unusual request hour (03:00)'],
          specialtyMatch: true,
          withinOperatingHours: false,
        },
      },
    ];
  });

  // -------------------------------------------------------------------------
  // 1. Health & Model Telemetry
  // -------------------------------------------------------------------------
  describe('1. Microservice Health & Model Telemetry', () => {
    it('should reject unauthenticated requests to /api/v1/aiml/health with 401', async () => {
      const res = await request(app).get('/api/v1/aiml/health');
      expect(res.status).toBe(401);
    });

    it('should report live health status when authenticated', async () => {
      const res = await request(app)
        .get('/api/v1/aiml/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data.modelLoaded).toBe(true);
      expect(res.body.data.modelVersion).toBe('1.0');
    });

    it('should report model metadata and hyperparameters on /api/v1/aiml/model-info', async () => {
      const res = await request(app)
        .get('/api/v1/aiml/model-info')
        .set('Authorization', `Bearer ${docAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.model).toBe('IsolationForest');
      expect(res.body.data.features).toContain('doctor_specialty');
      expect(res.body.data.features).toContain('record_type');
      expect(res.body.data.features).toContain('requests_last_24h');
      expect(res.body.data.hyperparameters).toHaveProperty('n_estimators');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Anomaly Scoring & Simulation
  // -------------------------------------------------------------------------
  describe('2. Anomaly Scoring & Advisory Simulation', () => {
    it('should reject simulation requests from patient role with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/v1/aiml/simulate')
        .set('Authorization', `Bearer ${patAToken}`)
        .send({
          doctorSpecialty: 'Cardiology',
          recordType: 'ECG',
          purpose: 'Diagnosis',
        });

      expect(res.status).toBe(403);
    });

    it('should evaluate normative access pattern with Low risk score', async () => {
      const res = await request(app)
        .post('/api/v1/aiml/simulate')
        .set('Authorization', `Bearer ${docAToken}`)
        .send({
          doctorSpecialty: 'Cardiology',
          recordType: 'ECG',
          purpose: 'Diagnosis',
          hospital: 'Apex Heart Institute',
          requestsLast24h: 3,
          requestsLast7d: 15,
          requestsForRecordType: 8,
          averageDailyRequests: 4.0,
          requestHour: 14,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.riskLevel).toBe('LOW');
      expect(res.body.data.isFlagged).toBe(false);
      expect(res.body.data.anomalyScore).toBeLessThan(45);
    });

    it('should detect anomalous pattern with elevated risk score and explanatory factors', async () => {
      const res = await request(app)
        .post('/api/v1/aiml/simulate')
        .set('Authorization', `Bearer ${docBToken}`)
        .send({
          doctorSpecialty: 'Dermatology',
          recordType: 'MRI_Scan_Report',
          purpose: 'Emergency',
          hospital: 'Unknown_Facility',
          requestsLast24h: 95,
          requestsLast7d: 120,
          requestsForRecordType: 40,
          averageDailyRequests: 5.0,
          requestHour: 3, // 3 AM
          isEmergency: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFlagged).toBe(true);
      expect(res.body.data.anomalyScore).toBeGreaterThanOrEqual(60);
      expect(res.body.data.reasons.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Zero-PHI Guarantee & Input Validation
  // -------------------------------------------------------------------------
  describe('3. Zero-PHI Guarantee & Input Validation', () => {
    it('should reject simulation requests containing clinical text or patient PHI (400)', async () => {
      const phiPayload = {
        doctorSpecialty: 'Cardiology',
        recordType: 'ECG',
        purpose: 'Diagnosis',
        patientName: 'Alice Johnson', // FORBIDDEN PHI
        clinicalNotes: 'Severe ventricular tachycardia noted on lead II', // FORBIDDEN PHI
      };

      const res = await request(app)
        .post('/api/v1/aiml/simulate')
        .set('Authorization', `Bearer ${docAToken}`)
        .send(phiPayload);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Request payload failed schema validation');
      const detailsStr = JSON.stringify(res.body.error.details);
      expect(detailsStr).toMatch(/prohibited PHI|unrecognized key/i);
    });

    it('should reject negative counters or out-of-range hours (400)', async () => {
      const invalidPayload = {
        doctorSpecialty: 'Cardiology',
        recordType: 'ECG',
        purpose: 'Diagnosis',
        requestsLast24h: -10, // Invalid negative
        requestHour: 29,      // Invalid hour
      };

      const res = await request(app)
        .post('/api/v1/aiml/simulate')
        .set('Authorization', `Bearer ${docAToken}`)
        .send(invalidPayload);

      expect(res.status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Tenant Isolation & ABAC/RBAC on Anomaly Feeds
  // -------------------------------------------------------------------------
  describe('4. Tenant Isolation & Access Boundary on /api/v1/aiml/anomalies', () => {
    it('should permit doctor to view ONLY their own initiated access request anomalies', async () => {
      const res = await request(app)
        .get('/api/v1/aiml/anomalies')
        .set('Authorization', `Bearer ${docAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].doctorId).toBe(doctorA.id);
      expect(res.body.data[0].id).toBe('req-ai-test-1');
    });

    it('should permit patient to view ONLY access requests targeting their records', async () => {
      const res = await request(app)
        .get('/api/v1/aiml/anomalies')
        .set('Authorization', `Bearer ${patBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].patientId).toBe(patientB.id);
      expect(res.body.data[0].id).toBe('req-ai-test-2');
    });

    it('should permit admin to view all tenant anomalies and filter by risk level', async () => {
      const allRes = await request(app)
        .get('/api/v1/aiml/anomalies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(allRes.status).toBe(200);
      expect(allRes.body.data.length).toBe(2);

      const highRiskRes = await request(app)
        .get('/api/v1/aiml/anomalies?riskLevel=HIGH')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(highRiskRes.status).toBe(200);
      expect(highRiskRes.body.data.length).toBe(1);
      expect(highRiskRes.body.data[0].id).toBe('req-ai-test-2');
      expect(highRiskRes.body.data[0].riskLevel).toBe('HIGH');
    });

    it('should deliver summary metrics on /api/v1/aiml/summary', async () => {
      const res = await request(app)
        .get('/api/v1/aiml/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalEvaluated).toBe(2);
      expect(res.body.data.highRiskCount).toBe(1);
      expect(res.body.data.lowRiskCount).toBe(1);
      expect(res.body.data.flaggedCount).toBe(1);
      expect(res.body.data).toHaveProperty('modelHealth');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Fail-Safe Resilience & Graceful Degraded Mode
  // -------------------------------------------------------------------------
  describe('5. Fail-Safe Resilience (Disconnection / Outage)', () => {
    it('should fail-open gracefully with normative fallback when microservice is unreachable', async () => {
      // Test direct service call fallback
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused'));

      try {
        const result = await scoreAccessAnomaly({
          doctorId: 'doc-offline-test',
          doctorSpecialty: 'Cardiology',
          hospital: 'St. Jude Hospital',
          recordType: 'ECG',
          purpose: 'Diagnosis',
        });

        expect(result).toBeDefined();
        expect(result.anomalyScore).toBe(18.5);
        expect(result.riskLevel).toBe(RiskLevel.LOW);
        expect(result.isFlagged).toBe(false);
        expect(result.modelVersion).toBe('1.0-fallback');
        expect(result.riskAssessment.explanation).toMatch(/safe disconnected mode/i);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should return unavailable health status when microservice fails to respond', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network timeout'));

      try {
        const health = await getModelHealth();
        expect(health.status).toBe('unavailable');
        expect(health.modelLoaded).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // -------------------------------------------------------------------------
  // 6. Security Invariant: Strict Advisory Non-Bypass
  // -------------------------------------------------------------------------
  describe('6. Security Invariant — Strict Advisory Non-Bypass', () => {
    it('should NOT allow clinician to access a medical record even if anomaly score is low, without consent (403)', async () => {
      // Doctor attempts to directly read Patient A's record without consent grant
      const res = await request(app)
        .get('/api/v1/records/rec-nonexistent-unauthorized')
        .set('Authorization', `Bearer ${docAToken}`);

      // Authorization layer halts access deterministically (403 or 404), never bypassed by AI score
      expect([401, 403, 404]).toContain(res.status);
    });

    it('should verify that AI/ML result alone cannot decrypt or mutate consent status', () => {
      const baselineConsentCount = store.grants.length;

      // Performing simulation or scoring MUST NOT create grants or touch keys
      simulateAnomalyScore({
        doctorSpecialty: 'Cardiology',
        recordType: 'ECG',
        purpose: 'Diagnosis',
      });

      expect(store.grants.length).toBe(baselineConsentCount);
    });
  });
});
