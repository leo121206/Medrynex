import { Request, Response, NextFunction } from 'express';
import {
  createAccessRequest,
  getPatientRequests,
  getDoctorRequests,
  rejectAccessRequest,
} from '../services/request.service';
import { ApiResponse } from '../utils/apiResponse';

export const createRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await createAccessRequest(
      {
        ...req.body,
        enforceTrustHierarchy: req.body.enforceTrustHierarchy ?? true,
      },
      req.user!
    );
    ApiResponse.created(res, result, 'Patient-level access request created and evaluated by AI scoring engine');
  } catch (error) {
    next(error);
  }
};

export const listPatientRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const patientId = req.user?.role === 'PATIENT' ? req.user.id : (req.query.patientId as string);
    const result = await getPatientRequests(patientId);
    ApiResponse.success(res, result, 'Patient access requests fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const listDoctorRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const doctorId = req.user?.role === 'DOCTOR' ? req.user.id : (req.query.doctorId as string);
    const result = await getDoctorRequests(doctorId);
    ApiResponse.success(res, result, 'Doctor access requests fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const listAllRequests = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getPatientRequests();
    ApiResponse.success(res, result, 'All access requests fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const rejectRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawId = req.params.id || req.body.requestId || req.body.id;
    const requestId = Array.isArray(rawId) ? rawId[0] : rawId;
    const result = await rejectAccessRequest(requestId, req.user!);
    ApiResponse.success(res, result, 'Access request successfully rejected');
  } catch (error) {
    next(error);
  }
};
