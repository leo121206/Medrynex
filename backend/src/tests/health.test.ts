import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('Health Check API (/api/v1/health)', () => {
  it('should return 200 OK and healthy status', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toMatchObject({
      status: 'healthy',
      environment: expect.any(String),
      nodeVersion: expect.any(String),
      uptimeSeconds: expect.any(Number),
    });
    expect(response.body.data.services).toHaveProperty('database');
    expect(response.body.data.services).toHaveProperty('ganacheRpc');
    expect(response.body.data.services).toHaveProperty('ipfsGateway');
  });

  it('should return 404 with standard error structure for unknown routes', async () => {
    const response = await request(app).get('/api/v1/unknown-endpoint');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Endpoint GET /api/v1/unknown-endpoint not found',
      },
    });
    expect(response.body.error.requestId).toBeDefined();
  });

  it('should return 200 OK for Kubernetes liveness probe', async () => {
    const response = await request(app).get('/api/v1/health/liveness');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('UP');
    expect(response.body.data).toHaveProperty('timestamp');
    expect(response.body.data).toHaveProperty('uptimeSeconds');
  });

  it('should return 200 OK for readiness probe with dependency checks', async () => {
    const response = await request(app).get('/api/v1/health/readiness');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('READY');
    expect(response.body.data.checks).toHaveProperty('database');
    expect(response.body.data.checks).toHaveProperty('kms');
    expect(response.body.data.checks).toHaveProperty('storage');
  });

  it('should expose OpenAPI 3.0 specification at /api/v1/docs.json', async () => {
    const response = await request(app).get('/api/v1/docs.json');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('openapi', '3.0.3');
    expect(response.body.info).toHaveProperty('title', 'Medrynx EHR Platform API');
  });

  it('should return 200 OK for root index route', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('name', 'Medrynx EHR Backend API');
    expect(response.body).toHaveProperty('version', '1.0.0');
  });
});
