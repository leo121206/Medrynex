import { Request, Response, NextFunction } from 'express';
import {
  createTrustRelationship,
  getTrustRelationships,
  getTrustRelationshipById,
  acceptTrustRelationship,
  rejectTrustRelationship,
  revokeTrustRelationship,
  transitionTrustRelationshipTier,
  evaluatePatientDoctorTrust,
  getDoctorPatientDirectory,
  getVerifiedDoctorsDirectory,
} from '../services/relationship.service';
import { ApiResponse } from '../utils/apiResponse';
import { RelationshipStatus, RelationshipType } from '@prisma/client';

export const createRelationship = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const relationship = await createTrustRelationship(req.body, req.user!);
    ApiResponse.created(res, relationship, 'Trust relationship request submitted successfully');
  } catch (error) {
    next(error);
  }
};

export const getRelationships = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const relationships = await getTrustRelationships(req.user!, {
      status: req.query.status as RelationshipStatus | undefined,
      type: req.query.type as RelationshipType | undefined,
    });
    ApiResponse.success(res, relationships, 'Trust relationships fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const getPatientDirectory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const directory = await getDoctorPatientDirectory(req.user!);
    ApiResponse.success(res, directory, 'Patient directory and T0-T3 trust status fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const getDoctorsDirectory = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const doctors = await getVerifiedDoctorsDirectory();
    ApiResponse.success(res, doctors, 'Verified clinicians fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const evaluateTrust = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const doctorId = (req.query.doctorId as string) || req.user!.id;
    const evaluation = await evaluatePatientDoctorTrust(patientId, doctorId);
    ApiResponse.success(res, evaluation, 'Trust hierarchy evaluation completed');
  } catch (error) {
    next(error);
  }
};

export const getRelationshipById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const relationshipId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const relationship = await getTrustRelationshipById(relationshipId, req.user!);
    ApiResponse.success(res, relationship, 'Trust relationship fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const acceptRelationship = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const relationshipId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const relationship = await acceptTrustRelationship(relationshipId, req.user!);
    ApiResponse.success(res, relationship, 'Trust relationship accepted and activated');
  } catch (error) {
    next(error);
  }
};

export const transitionRelationship = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const relationshipId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { relationshipType } = req.body;
    const relationship = await transitionTrustRelationshipTier(
      relationshipId,
      relationshipType as RelationshipType,
      req.user!
    );
    ApiResponse.success(res, relationship, 'Trust relationship tier transitioned successfully');
  } catch (error) {
    next(error);
  }
};

export const rejectRelationship = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const relationshipId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const relationship = await rejectTrustRelationship(relationshipId, req.user!);
    ApiResponse.success(res, relationship, 'Trust relationship rejected');
  } catch (error) {
    next(error);
  }
};

export const revokeRelationship = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const relationshipId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const relationship = await revokeTrustRelationship(relationshipId, req.user!);
    ApiResponse.success(res, relationship, 'Trust relationship successfully revoked');
  } catch (error) {
    next(error);
  }
};

