import { Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import * as mlService from '../services/ml.service';
import { AIMLAnomalyFilterParams } from '../types/aiml.types';

/**
 * Controller exposing AI/ML Advisory capabilities.
 * Strictly advisory: endpoints provide risk intelligence, model telemetry, and pattern evaluations.
 */
export const getModelHealth = async (_req: Request, res: Response) => {
  const health = await mlService.getModelHealth();
  return ApiResponse.success(res, health, 'AI/ML service health status retrieved');
};

export const getModelInfo = async (_req: Request, res: Response) => {
  const info = await mlService.getModelInfo();
  return ApiResponse.success(res, info, 'AI/ML model metadata and hyperparameters retrieved');
};

export const simulateScore = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const result = await mlService.simulateAnomalyScore(req.body);
  return ApiResponse.success(res, result, 'Access pattern simulated and scored successfully');
};

export const getAnomalies = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const filters: AIMLAnomalyFilterParams = {
    riskLevel: req.query.riskLevel as string | undefined,
    isFlagged: req.query.isFlagged !== undefined ? req.query.isFlagged === 'true' : undefined,
    doctorId: req.query.doctorId as string | undefined,
    patientId: req.query.patientId as string | undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
  };

  const anomalies = await mlService.getTenantAnomalies(req.user, filters);
  return ApiResponse.success(res, anomalies, 'Tenant access anomaly records retrieved successfully');
};

export const getSummary = async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }

  const summary = await mlService.getAdvisorySummary(req.user);
  return ApiResponse.success(res, summary, 'AI/ML advisory summary metrics retrieved successfully');
};
