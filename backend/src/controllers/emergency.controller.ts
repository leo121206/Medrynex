import { Request, Response, NextFunction } from 'express';
import {
  declareEmergency,
  getEmergencyEvents,
  reconcileEmergencyEvent,
  disputeEmergencyEvent,
  getDisputesList,
  revokeEmergencyAccess,
  getActiveEmergencySessions,
} from '../services/emergency.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export const triggerEmergency = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await declareEmergency(req.body, req.user!);
    return ApiResponse.created(res, result, 'Emergency break-glass access declared and time-locked');
  } catch (error) {
    next(error);
  }
};

export const getActiveEmergencies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = req.user?.role === 'DOCTOR' ? req.user.id : undefined;
    const patientId = req.user?.role === 'PATIENT' ? req.user.id : (req.query.patientId as string);
    const result = await getActiveEmergencySessions(doctorId, patientId);
    return ApiResponse.success(res, result, 'Active emergency sessions fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const revokeEmergency = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const emergencyId = req.body.emergencyId || req.body.id || (req.query.emergencyId as string);
    if (!emergencyId) {
      throw ApiError.badRequest('emergencyId is required to revoke emergency access');
    }
    const result = await revokeEmergencyAccess(emergencyId, req.user!);
    return ApiResponse.success(res, result, 'Emergency break-glass access revoked successfully');
  } catch (error) {
    next(error);
  }
};

export const listEmergencyHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = req.user?.role === 'PATIENT' ? req.user.id : (req.query.patientId as string);
    const doctorId = req.user?.role === 'DOCTOR' ? req.user.id : undefined;
    const result = await getEmergencyEvents(patientId, doctorId);
    return ApiResponse.success(res, result, 'Emergency history fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const reconcileEmergency = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { emergencyId } = req.body;
    const result = await reconcileEmergencyEvent(emergencyId, req.user!);
    return ApiResponse.success(res, result, 'Emergency event reconciled successfully');
  } catch (error) {
    next(error);
  }
};

export const disputeEmergency = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await disputeEmergencyEvent(req.body, req.user!);
    return ApiResponse.created(res, result, 'Dispute recorded immutably on-chain');
  } catch (error) {
    next(error);
  }
};

export const listDisputes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = req.user?.role === 'PATIENT' ? req.user.id : undefined;
    const result = await getDisputesList(patientId);
    return ApiResponse.success(res, result, 'Disputes fetched successfully');
  } catch (error) {
    next(error);
  }
};
