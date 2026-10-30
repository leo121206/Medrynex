/**
 * Medrynx Platform - Phase 15 Observability, Reliability & Resilience Test Suite
 * 
 * Verifies:
 * 1. Metrics API authentication, authorization, and output formats (Prometheus text & JSON).
 * 2. High-cardinality route sanitization and zero-PHI guarantees.
 * 3. Correlation ID generation and bidirectional propagation.
 * 4. Dependency health probe taxonomy (HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN) and timeouts.
 * 5. Circuit breaker state transitions, fail-fast rejections, and recovery.
 * 6. Bounded retries with security fail-closed non-retryable guards.
 * 7. Execution timeout enforcement.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { env } from '../config/env';
import { metricsRegistry } from '../services/metrics.service';
import { withProbeTimeout, ComponentHealth } from '../services/health.service';
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerOpenError,
  retryWithBackoff,
  withTimeout,
  TimeoutError
} from '../utils/resilience';

describe('Phase 15 - Observability & Reliability Suite', () => {

  describe('1. Protected Telemetry & Metrics API (/api/v1/metrics)', () => {
    it('should reject unauthenticated metrics scrape with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/metrics');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject metrics request with invalid internal key with 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/api/v1/metrics')
        .set('X-Medrynx-Internal-Key', 'invalid-secret-key-12345');
      expect(res.status).toBe(401);
    });

    it('should grant access to internal scraper presenting valid X-Medrynx-Internal-Key', async () => {
      const res = await request(app)
        .get('/api/v1/metrics')
        .set('X-Medrynx-Internal-Key', env.INTERNAL_SERVICE_KEY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('uptimeSeconds');
      expect(res.body.data).toHaveProperty('system');
      expect(res.body.data).toHaveProperty('http');
      expect(res.body.data).toHaveProperty('security');
      expect(res.body.data).toHaveProperty('subsystems');
    });

    it('should return valid Prometheus text format when format=prometheus query parameter is provided', async () => {
      const res = await request(app)
        .get('/api/v1/metrics?format=prometheus')
        .set('X-Medrynx-Internal-Key', env.INTERNAL_SERVICE_KEY);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('# HELP medrynx_http_requests_total');
      expect(res.text).toContain('# TYPE medrynx_http_requests_total counter');
      expect(res.text).toContain('# HELP medrynx_process_heap_bytes');
    });

    it('should return valid Prometheus text format when Accept: text/plain header is sent', async () => {
      const res = await request(app)
        .get('/api/v1/metrics')
        .set('X-Medrynx-Internal-Key', env.INTERNAL_SERVICE_KEY)
        .set('Accept', 'text/plain');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('medrynx_');
    });
  });

  describe('2. Cardinality Sanitization & Zero-PHI Metrics Safeguards', () => {
    it('should sanitize dynamic record IDs, patient IDs, UUIDs, and Ethereum addresses to static templates', () => {
      const rawUrls = [
        '/api/v1/records/rec-abc12345-uuid?include=true',
        '/api/v1/patients/pat-999-synthetic',
        '/api/v1/audit/tx/0x8E45C0936fa1a65bDaD3222bEFeC6a03C83372cE',
        '/api/v1/users/550e8400-e29b-41d4-a716-446655440000/profile',
      ];

      const clean0 = metricsRegistry.sanitizeRoute(rawUrls[0]);
      const clean1 = metricsRegistry.sanitizeRoute(rawUrls[1]);
      const clean2 = metricsRegistry.sanitizeRoute(rawUrls[2]);
      const clean3 = metricsRegistry.sanitizeRoute(rawUrls[3]);

      expect(clean0).toBe('/api/v1/records/:recordId');
      expect(clean1).toBe('/api/v1/patients/:patientId');
      expect(clean2).toBe('/api/v1/audit/tx/:addressOrHash');
      expect(clean3).toBe('/api/v1/users/:uuid/profile');
    });

    it('should not contain any un-sanitized patient or record identifiers in Prometheus output', () => {
      // Record a synthetic request with dynamic path
      metricsRegistry.recordHttpRequest('GET', '/api/v1/records/rec-chaos-999', 200, 45);
      const output = metricsRegistry.getPrometheusFormat();

      expect(output).toContain('route="/api/v1/records/:recordId"');
      expect(output).not.toContain('rec-chaos-999');
    });
  });

  describe('3. Correlation ID & Distributed Tracing Context', () => {
    it('should auto-generate an X-Correlation-ID header if omitted in the ingress request', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      const corrId = res.headers['x-correlation-id'];
      expect(corrId).toBeDefined();
      expect(corrId.length).toBeGreaterThan(10);
    });

    it('should propagate an existing inbound X-Correlation-ID header verbatim in the response', async () => {
      const customTraceId = 'trace-synth-medrynx-12345-prod';
      const res = await request(app)
        .get('/api/v1/health')
        .set('x-correlation-id', customTraceId);

      expect(res.status).toBe(200);
      expect(res.headers['x-correlation-id']).toBe(customTraceId);
    });
  });

  describe('4. Component Health Taxonomy & Deep Diagnostic Probes', () => {
    it('should report healthy liveness status on GET /api/v1/health', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
    });

    it('should return dependency health status taxonomy on GET /api/v1/health/dependencies', async () => {
      const res = await request(app)
        .get('/api/v1/health/dependencies')
        .set('X-Medrynx-Internal-Key', env.INTERNAL_SERVICE_KEY);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('dependencies');

      const deps = res.body.data.dependencies;
      const validStatuses: ComponentHealth[] = [
        'HEALTHY',
        'DEGRADED',
        'UNHEALTHY',
        'UNKNOWN',
      ];

      expect(validStatuses).toContain(deps.database.status);
      expect(validStatuses).toContain(deps.blockchain.status);
      expect(validStatuses).toContain(deps.storage.status);
      expect(validStatuses).toContain(deps.kms.status);
      expect(validStatuses).toContain(deps.aiml.status);
    });

    it('should handle timeout in probe checks via withProbeTimeout gracefully', async () => {
      const slowProbe = new Promise<string>((resolve) => setTimeout(() => resolve('done'), 500));
      const res = await withProbeTimeout(slowProbe, 50, 'UNAVAILABLE');

      expect(res).toBe('UNAVAILABLE');
    });
  });

  describe('5. Circuit Breaker Resilience & State Machine', () => {
    it('should transition from CLOSED to OPEN after consecutive failures and fast-fail', async () => {
      const breaker = new CircuitBreaker({
        name: 'test_breaker',
        failureThreshold: 3,
        recoveryTimeoutMs: 500,
      });

      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      const failingAction = async () => {
        throw new Error('Simulated external service error');
      };

      // 1st failure
      await expect(breaker.execute(failingAction)).rejects.toThrow('Simulated external service error');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // 2nd failure
      await expect(breaker.execute(failingAction)).rejects.toThrow('Simulated external service error');
      expect(breaker.getState()).toBe(CircuitState.CLOSED);

      // 3rd failure -> trips to OPEN
      await expect(breaker.execute(failingAction)).rejects.toThrow('Simulated external service error');
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // 4th call should fast-fail with CircuitBreakerOpenError without invoking the action
      let actionInvoked = false;
      await expect(
        breaker.execute(async () => {
          actionInvoked = true;
          return 'result';
        })
      ).rejects.toThrow(CircuitBreakerOpenError);

      expect(actionInvoked).toBe(false);
    });

    it('should execute fallback function when circuit is OPEN if fallback is supplied', async () => {
      const breaker = new CircuitBreaker({
        name: 'fallback_test_breaker',
        failureThreshold: 1,
        recoveryTimeoutMs: 5000,
      });

      // Trip the breaker
      await expect(breaker.execute(async () => { throw new Error('Downstream error'); })).rejects.toThrow();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Call with fallback
      const fallbackResult = await breaker.execute(
        async () => 'primary_result',
        async () => 'graceful_fallback_result'
      );

      expect(fallbackResult).toBe('graceful_fallback_result');
    });

    it('should transition to HALF_OPEN after recovery timeout and reset to CLOSED on successes', async () => {
      const breaker = new CircuitBreaker({
        name: 'recovery_test_breaker',
        failureThreshold: 2,
        recoveryTimeoutMs: 30, // 30ms for rapid test
        halfOpenSuccessThreshold: 2,
      });

      // Fail twice to open
      await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery timeout
      await new Promise((r) => setTimeout(r, 45));

      // Next check triggers HALF_OPEN
      expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);

      // First probe success
      const res1 = await breaker.execute(async () => 'probe_1_ok');
      expect(res1).toBe('probe_1_ok');

      // Second probe success -> resets to CLOSED
      const res2 = await breaker.execute(async () => 'probe_2_ok');
      expect(res2).toBe('probe_2_ok');

      expect(breaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('6. Bounded Retries & Security Fail-Closed Semantics', () => {
    it('should retry transient errors with exponential backoff until success', async () => {
      let attempts = 0;
      const transientAction = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Transient network glitch');
        }
        return 'success_on_attempt_3';
      };

      const result = await retryWithBackoff(transientAction, {
        maxRetries: 3,
        initialDelayMs: 10,
        backoffFactor: 1.5,
        jitter: false,
      });

      expect(result).toBe('success_on_attempt_3');
      expect(attempts).toBe(3);
    });

    it('should NEVER retry authentication or authorization errors (fail-closed security)', async () => {
      let attempts = 0;
      const authErrorAction = async () => {
        attempts++;
        const authErr = new Error('Invalid JWT token');
        authErr.name = 'UnauthorizedError';
        (authErr as any).status = 401;
        throw authErr;
      };

      await expect(
        retryWithBackoff(authErrorAction, {
          maxRetries: 5,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Invalid JWT token');

      // Must fail immediately on attempt 1 without retrying!
      expect(attempts).toBe(1);
    });

    it('should NEVER retry 403 Forbidden errors', async () => {
      let attempts = 0;
      const forbiddenAction = async () => {
        attempts++;
        const forbErr = new Error('Consent denied');
        (forbErr as any).statusCode = 403;
        throw forbErr;
      };

      await expect(
        retryWithBackoff(forbiddenAction, {
          maxRetries: 5,
          initialDelayMs: 10,
        })
      ).rejects.toThrow('Consent denied');

      expect(attempts).toBe(1);
    });
  });

  describe('7. Execution Timeout Protection', () => {
    it('should reject with TimeoutError if the promise exceeds the specified threshold', async () => {
      const slowPromise = new Promise((resolve) => setTimeout(resolve, 200));

      await expect(withTimeout(slowPromise, 50, 'slow_test_op')).rejects.toThrow(TimeoutError);
    });

    it('should resolve normally if the promise completes within the timeout limit', async () => {
      const fastPromise = new Promise((resolve) => setTimeout(() => resolve('fast_ok'), 10));

      const res = await withTimeout(fastPromise, 200, 'fast_test_op');
      expect(res).toBe('fast_ok');
    });
  });
});
