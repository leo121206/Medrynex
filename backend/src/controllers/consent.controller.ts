import { Request, Response, NextFunction } from 'express';
import {
  getActiveConsents,
  getAllConsents,
  grantScopedConsent,
  revokeConsent,
  getConsentBatches,
  approveConsentBatch,
} from '../services/consent.service';
import { ApiResponse } from '../utils/apiResponse';

export const listActiveConsents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const patientId = req.user?.role === 'PATIENT' ? req.user.id : undefined;
    const result = await getActiveConsents(patientId);
    ApiResponse.success(res, result, 'Active dynamic consents fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const grantConsent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await grantScopedConsent(req.body, req.user!);
    ApiResponse.created(res, result, 'Scope-bound dynamic consent granted and anchored');
  } catch (error) {
    next(error);
  }
};

export const revoke = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawId = req.params.id || req.body.grantId || req.body.consentId || req.body.id;
    const grantId = Array.isArray(rawId) ? rawId[0] : rawId;
    const result = await revokeConsent(grantId, req.user!);
    ApiResponse.success(res, result, 'Consent grant successfully revoked on-chain');
  } catch (error) {
    next(error);
  }
};

export const listBatches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getConsentBatches(req.user?.id);
    ApiResponse.success(res, result, 'Consent batches fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const approveBatch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { batchId } = req.body;
    const result = await approveConsentBatch(batchId, req.user!);
    ApiResponse.success(res, result, 'Consent batch approved and minted');
  } catch (error) {
    next(error);
  }
};

export const listHistoryConsents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const patientId = req.user?.role === 'PATIENT' ? req.user.id : (req.query.patientId as string);
    const doctorId = req.user?.role === 'DOCTOR' ? req.user.id : (req.query.doctorId as string);
    const result = await getAllConsents(patientId, doctorId);
    ApiResponse.success(res, result, 'All dynamic consents history fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const listDoctorConsents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doctorId = req.user!.id;
    const result = await getActiveConsents(undefined, doctorId);
    ApiResponse.success(res, result, 'Doctor active consent grants fetched successfully');
  } catch (error) {
    next(error);
  }
};
