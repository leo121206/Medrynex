import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { ApiError } from '../utils/apiError';
import { errorHandler } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validate';

const createTestApp = () => {
  const testApp = express();
  testApp.use(express.json());

  testApp.get('/api/test/error-400', () => {
    throw ApiError.badRequest('Invalid parameter supplied', 'INVALID_PARAM');
  });

  testApp.get('/api/test/error-401', () => {
    throw ApiError.unauthorized('Authentication token missing');
  });

  testApp.get('/api/test/error-403', () => {
    throw ApiError.forbidden('Only doctors can access this endpoint');
  });

  testApp.get('/api/test/error-404', () => {
    throw ApiError.notFound('Medical record not found');
  });

  const testSchema = z.object({
    body: z.object({
      email: z.string().email(),
      age: z.number().min(18),
    }),
  });

  testApp.post('/api/test/validate', validateRequest(testSchema), (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  testApp.use(errorHandler);
  return testApp;
};

describe('Centralized Error Handler Middleware', () => {
  const testApp = createTestApp();

  it('should handle ApiError.badRequest (400)', async () => {
    const res = await request(testApp).get('/api/test/error-400');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PARAM');
    expect(res.body.error.message).toBe('Invalid parameter supplied');
  });

  it('should handle ApiError.unauthorized (401)', async () => {
    const res = await request(testApp).get('/api/test/error-401');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should handle ApiError.forbidden (403)', async () => {
    const res = await request(testApp).get('/api/test/error-403');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should handle ApiError.notFound (404)', async () => {
    const res = await request(testApp).get('/api/test/error-404');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should format Zod validation errors as 400 Bad Request', async () => {
    const res = await request(testApp)
      .post('/api/test/validate')
      .send({ email: 'not-an-email', age: 16 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});
