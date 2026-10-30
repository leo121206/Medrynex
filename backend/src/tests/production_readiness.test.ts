import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { env, validateProductionConfig } from '../config/env';
import { logger } from '../config/logger';
import { createRateLimiter } from '../middleware/rateLimiter';
import { localKms, LocalKeyManagementService } from '../crypto/kms/LocalKeyManagementService';
import { checkLiveness, checkReadiness, checkSystemHealth } from '../services/health.service';
import express, { Request, Response } from 'express';

describe('MEDRYNX PHASE 12 — PRODUCTION READINESS & DEPLOYMENT HARDENING TEST SUITE', () => {
  // -------------------------------------------------------------------------
  // 1. Production Configuration & Secret Hardening
  // -------------------------------------------------------------------------
  describe('1. Production Configuration & Insecure Default Rejection', () => {
    it('should reject development default JWT_SECRET when NODE_ENV is production', () => {
      const invalidConfig = {
        ...env,
        NODE_ENV: 'production' as const,
        JWT_SECRET: 'medrynx_super_secret_jwt_key_2026_change_in_production',
      };

      const result = validateProductionConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('JWT_SECRET must be set to a secure production secret'))).toBe(true);
    });

    it('should reject JWT_SECRET shorter than 32 characters in production', () => {
      const invalidConfig = {
        ...env,
        NODE_ENV: 'production' as const,
        JWT_SECRET: 'short_secret_under_32_bytes!',
      };

      const result = validateProductionConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least 32 characters'))).toBe(true);
    });

    it('should reject development placeholder AES_SECRET_KEY in production', () => {
      const invalidConfig = {
        ...env,
        NODE_ENV: 'production' as const,
        JWT_SECRET: 'a_very_secure_production_jwt_secret_with_sufficient_length_2026',
        AES_SECRET_KEY: 'e4d909c290d0fb1ca068ffaddf22cbd0ffd83296c09dfb32525501869f06e0a3',
      };

      const result = validateProductionConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('AES_SECRET_KEY must be set to a unique 256-bit hexadecimal key'))).toBe(true);
    });

    it('should reject IPFS_MOCK_ENABLED=true in production', () => {
      const invalidConfig = {
        ...env,
        NODE_ENV: 'production' as const,
        JWT_SECRET: 'a_very_secure_production_jwt_secret_with_sufficient_length_2026',
        AES_SECRET_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        IPFS_MOCK_ENABLED: true,
      };

      const result = validateProductionConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('IPFS_MOCK_ENABLED must be false'))).toBe(true);
    });

    it('should reject wildcard CORS (*) in production when credentials are used', () => {
      const invalidConfig = {
        ...env,
        NODE_ENV: 'production' as const,
        JWT_SECRET: 'a_very_secure_production_jwt_secret_with_sufficient_length_2026',
        AES_SECRET_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        IPFS_MOCK_ENABLED: false,
        CORS_ORIGIN: '*',
      };

      const result = validateProductionConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('CORS_ORIGIN cannot contain wildcard'))).toBe(true);
    });

    it('should reject known public Hardhat test private keys in production', () => {
      const invalidConfig = {
        ...env,
        NODE_ENV: 'production' as const,
        JWT_SECRET: 'a_very_secure_production_jwt_secret_with_sufficient_length_2026',
        AES_SECRET_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        IPFS_MOCK_ENABLED: false,
        CORS_ORIGIN: 'https://medrynx.hospital.org',
        DEPLOYER_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      };

      const result = validateProductionConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('public Hardhat test account key'))).toBe(true);
    });

    it('should accept a fully hardened production configuration', () => {
      const validConfig = {
        ...env,
        NODE_ENV: 'production' as const,
        JWT_SECRET: 'super_secure_enterprise_grade_jwt_secret_min_32_characters_2026',
        AES_SECRET_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        IPFS_MOCK_ENABLED: false,
        CORS_ORIGIN: 'https://app.medrynx.org,https://portal.medrynx.org',
        DEPLOYER_PRIVATE_KEY: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        INTERNAL_SERVICE_KEY: 'secure-microservice-cluster-key-9921',
      };

      const result = validateProductionConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Secret Exposure Prevention & Health Telemetry
  // -------------------------------------------------------------------------
  describe('2. Secret Exposure Prevention in Health & API Endpoints', () => {
    it('should never expose database credentials or passwords in /api/v1/health', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);

      const jsonStr = JSON.stringify(res.body);
      expect(jsonStr).not.toContain('postgres:');
      expect(jsonStr).not.toContain('password');
      expect(jsonStr).not.toContain(env.JWT_SECRET);
      expect(jsonStr).not.toContain(env.AES_SECRET_KEY);
      expect(jsonStr).not.toContain('0xac0974');
    });

    it('should sanitize blockchain and storage endpoints in health services', async () => {
      const health = await checkSystemHealth();
      expect(health.services.ganacheRpc).toBe('configured');
      expect(health.services.ipfsGateway).toBe('configured');
      expect(health.services).toHaveProperty('aiml');
    });

    it('should report liveness status UP on /api/v1/health/liveness', async () => {
      const res = await request(app).get('/api/v1/health/liveness');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('UP');
      expect(res.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    it('should report readiness status including aiml dependency on /api/v1/health/readiness', async () => {
      const res = await request(app).get('/api/v1/health/readiness');
      expect([200, 503]).toContain(res.status);
      expect(res.body.data).toHaveProperty('checks');
      expect(res.body.data.checks).toHaveProperty('database');
      expect(res.body.data.checks).toHaveProperty('kms');
      expect(res.body.data.checks).toHaveProperty('storage');
      expect(res.body.data.checks).toHaveProperty('blockchain');
      expect(res.body.data.checks).toHaveProperty('aiml');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Request Correlation ID & Distributed Tracing
  // -------------------------------------------------------------------------
  describe('3. Request Correlation ID & Distributed Tracing', () => {
    it('should automatically assign a unique X-Request-Id header to every request', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
    });

    it('should preserve and reflect upstream X-Request-Id for distributed tracing', async () => {
      const customTraceId = 'trace-hospital-proxy-884920';
      const res = await request(app)
        .get('/')
        .set('X-Request-Id', customTraceId);

      expect(res.headers['x-request-id']).toBe(customTraceId);
    });

    it('should attach requestId to 404 error responses', async () => {
      const res = await request(app).get('/api/v1/non-existent-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.error).toHaveProperty('requestId');
      expect(res.body.error.requestId).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Rate Limiting & Denial of Service Protection
  // -------------------------------------------------------------------------
  describe('4. Rate Limiting & Abuse Defense', () => {
    it('should throttle and return 429 Too Many Requests when rate limit is exceeded', async () => {
      const testLimiterApp = express();
      const testLimiter = createRateLimiter({
        windowMs: 5000,
        maxRequests: 3,
        skipInTest: false,
        message: 'Throttled for test verification',
      });

      testLimiterApp.use(testLimiter);
      testLimiterApp.get('/test-limit', (_req: Request, res: Response) => {
        res.json({ success: true });
      });

      // Request 1, 2, 3: Should succeed
      const r1 = await request(testLimiterApp).get('/test-limit');
      expect(r1.status).toBe(200);
      expect(r1.headers['ratelimit-remaining']).toBe('2');

      const r2 = await request(testLimiterApp).get('/test-limit');
      expect(r2.status).toBe(200);
      expect(r2.headers['ratelimit-remaining']).toBe('1');

      const r3 = await request(testLimiterApp).get('/test-limit');
      expect(r3.status).toBe(200);
      expect(r3.headers['ratelimit-remaining']).toBe('0');

      // Request 4: Exceeds threshold -> 429 Too Many Requests
      const r4 = await request(testLimiterApp).get('/test-limit');
      expect(r4.status).toBe(429);
      expect(r4.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(r4.headers['retry-after']).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 5. Security Headers & CORS Enforcement
  // -------------------------------------------------------------------------
  describe('5. Enterprise Security Headers & CORS', () => {
    it('should set X-Frame-Options to DENY and X-Content-Type-Options to nosniff', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should expose RateLimit and X-Request-Id headers via Access-Control-Expose-Headers', async () => {
      const res = await request(app).get('/');
      const exposed = res.headers['access-control-expose-headers'];
      expect(exposed).toContain('X-Request-Id');
      expect(exposed).toContain('RateLimit-Limit');
    });
  });

  // -------------------------------------------------------------------------
  // 6. Logging Privacy & Automated Secret Redaction
  // -------------------------------------------------------------------------
  describe('6. Logging Privacy & PHI/Secret Redaction', () => {
    it('should redact passwords, tokens, and encryption keys from metadata in logs', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('Testing sensitive metadata log', {
        password: 'SuperSecretPassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
        kek: 'e4d909c290d0fb1ca068ffaddf22cbd0ffd83296c09dfb32525501869f06e0a3',
        patientName: 'John Doe',
        unrelatedCounter: 42,
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      const loggedCall = consoleWarnSpy.mock.calls[0][0];

      expect(loggedCall).not.toContain('SuperSecretPassword123!');
      expect(loggedCall).not.toContain('John Doe');
      expect(loggedCall).toContain('[REDACTED]');
      expect(loggedCall).toContain('"unrelatedCounter":42');

      consoleWarnSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // 7. KMS Operational Integrity & Decryption Guard
  // -------------------------------------------------------------------------
  describe('7. KMS Operational Integrity & Envelope Hardening', () => {
    it('should reject development placeholder KEK when STRICT_PROD_ENFORCE is set in production', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevStrict = process.env.STRICT_PROD_ENFORCE;

      try {
        process.env.NODE_ENV = 'production';
        process.env.STRICT_PROD_ENFORCE = 'true';

        expect(() => {
          new LocalKeyManagementService('e4d909c290d0fb1ca068ffaddf22cbd0ffd83296c09dfb32525501869f06e0a3');
        }).toThrow(/Development placeholder KEK cannot be used/);
      } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.STRICT_PROD_ENFORCE = prevStrict;
      }
    });

    it('should generate 32-byte DEKs and wrap/unwrap with byte-for-byte fidelity', async () => {
      const dek = localKms.generateDek();
      expect(dek.length).toBe(32);

      const wrapped = await localKms.wrapDek(dek);
      expect(wrapped.wrappedDek).toBeDefined();
      expect(wrapped.algorithm).toBe('AES-256-GCM/KEK-WRAP');

      const unwrapped = await localKms.unwrapDek(wrapped.wrappedDek, wrapped.keyVersion);
      expect(unwrapped.equals(dek)).toBe(true);
    });

    it('should reject tampered wrapped DEK payloads', async () => {
      const dek = localKms.generateDek();
      const wrapped = await localKms.wrapDek(dek);

      // Corrupt 1 byte in the base64 wrapped payload
      const buf = Buffer.from(wrapped.wrappedDek, 'base64');
      buf[20] ^= 0xff; // Flip bits in ciphertext portion
      const tamperedBase64 = buf.toString('base64');

      await expect(localKms.unwrapDek(tamperedBase64, wrapped.keyVersion)).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Deployment Smoke Test Simulation
  // -------------------------------------------------------------------------
  describe('8. Deployment Smoke Test & Platform Sanity', () => {
    it('should verify root health and basic API status', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Medrynx EHR Backend API');
      expect(res.body.version).toBe('1.0.0');
    });

    it('should verify OpenAPI specification endpoint is available', async () => {
      const res = await request(app).get('/api/v1/docs.json');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('openapi');
      expect(res.body.info.title).toBe('Medrynx EHR Platform API');
    });
  });
});
