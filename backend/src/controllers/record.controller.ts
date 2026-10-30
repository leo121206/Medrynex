import { Request, Response, NextFunction } from 'express';
import {
  uploadAndAnchorRecord,
  getRecordsList,
  getRecordById as fetchRecordById,
  downloadAndDecryptRecord,
  createRecordVersion,
  getRecordVersions,
  getRecordVersionById,
  downloadAndDecryptRecordVersion,
  tombstoneRecord,
} from '../services/record.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';
import { RecordCategory } from '@prisma/client';

export const uploadRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw ApiError.badRequest('No file uploaded. Attach a file in the form field "file"');
    }
    if (!req.body.title || !req.body.category) {
      throw ApiError.badRequest('Fields "title" and "category" are required');
    }

    const record = await uploadAndAnchorRecord(
      req.file,
      {
        title: req.body.title,
        category: req.body.category as RecordCategory,
        description: req.body.description,
        patientId: req.body.patientId,
        issuingClinician: req.body.issuingClinician,
        issuingHospital: req.body.issuingHospital,
        recordDate: req.body.recordDate,
      },
      req.user!
    );

    ApiResponse.created(res, record, 'Medical record encrypted, anchored, and stored successfully');
  } catch (error) {
    next(error);
  }
};

export const getRecords = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const records = await getRecordsList(req.user!, {
      patientId: req.query.patientId as string | undefined,
      category: req.query.category as RecordCategory | undefined,
    });
    ApiResponse.success(res, records, 'Medical records retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getRecordById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const record = await fetchRecordById(recordId, req.user!);
    ApiResponse.success(res, record, 'Medical record retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const downloadRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { decryptedBuffer, filename, contentType } = await downloadAndDecryptRecord(
      recordId,
      req.user!
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.send(decryptedBuffer);
  } catch (error) {
    next(error);
  }
};

export const uploadVersion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!req.file) {
      throw ApiError.badRequest('No file uploaded. Attach a revision file in form field "file"');
    }

    const version = await createRecordVersion(
      recordId,
      req.file,
      req.body.changeSummary,
      req.user!
    );

    ApiResponse.created(res, version, `Record version ${version.versionNumber} encrypted and anchored successfully`);
  } catch (error) {
    next(error);
  }
};

export const getVersions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const versions = await getRecordVersions(recordId, req.user!);
    ApiResponse.success(res, versions, 'Record version history retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getVersion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const versionParam = Array.isArray(req.params.versionNumber) ? req.params.versionNumber[0] : req.params.versionNumber;
    const versionNumber = parseInt(versionParam, 10);
    if (isNaN(versionNumber)) {
      throw ApiError.badRequest('Invalid version number');
    }

    const version = await getRecordVersionById(recordId, versionNumber, req.user!);
    ApiResponse.success(res, version, `Record version ${versionNumber} retrieved successfully`);
  } catch (error) {
    next(error);
  }
};

export const downloadVersion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const versionParam = Array.isArray(req.params.versionNumber) ? req.params.versionNumber[0] : req.params.versionNumber;
    const versionNumber = parseInt(versionParam, 10);
    if (isNaN(versionNumber)) {
      throw ApiError.badRequest('Invalid version number');
    }

    const { decryptedBuffer, filename, contentType } = await downloadAndDecryptRecordVersion(
      recordId,
      versionNumber,
      req.user!
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.send(decryptedBuffer);
  } catch (error) {
    next(error);
  }
};

export const deleteRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await tombstoneRecord(recordId, req.user!);
    ApiResponse.success(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

export const checkRecordIntegrity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { verifyRecordIntegrity } = await import('../services/audit.service');
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await verifyRecordIntegrity(recordId, req.user);
    ApiResponse.success(res, result, 'Record cryptographic integrity verified');
  } catch (error) {
    next(error);
  }
};
