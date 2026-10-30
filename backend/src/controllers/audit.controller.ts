import { Request, Response, NextFunction } from 'express';
import {
  getAuditLogs,
  getAuditLogById,
  verifyAuditEvidence,
  verifyRecordIntegrity,
  getEntityBlockchainEvidence,
  getSystemAnalytics,
} from '../services/audit.service';
import { store } from '../models/store';
import { prisma, isDbConnected } from '../models/db';
import { ApiResponse } from '../utils/apiResponse';

export const listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const patientId = req.user?.role === 'PATIENT' ? req.user.id : (req.query.patientId as string);
    const result = await getAuditLogs(
      {
        patientId,
        actorId: req.query.actorId as string,
        accessType: req.query.accessType as string,
        search: req.query.search as string,
      },
      req.user
    );
    ApiResponse.success(res, result, 'Audit logs fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const getAuditLog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await getAuditLogById(id, req.user);
    ApiResponse.success(res, result, 'Audit log retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const verifyAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await verifyAuditEvidence(id, req.user);
    ApiResponse.success(res, result, 'Audit log evidence verified against blockchain');
  } catch (error) {
    next(error);
  }
};

export const verifyRecord = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await verifyRecordIntegrity(id, req.user);
    ApiResponse.success(res, result, 'Record cryptographic integrity verified');
  } catch (error) {
    next(error);
  }
};

export const getEntityEvidence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const type = Array.isArray(req.params.type) ? req.params.type[0] : req.params.type;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await getEntityBlockchainEvidence(type, id, req.user);
    ApiResponse.success(res, result, 'Entity blockchain evidence retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await getSystemAnalytics();
    ApiResponse.success(res, result, 'Analytics metrics fetched successfully');
  } catch (error) {
    next(error);
  }
};

export const listAllUsers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (isDbConnected && !isTestEnv) {
      try {
        const dbUsers = await prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
        });
        const sanitizedUsers = dbUsers.map((u) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { passwordHash, ...sanitized } = u;
          return sanitized;
        });
        ApiResponse.success(res, sanitizedUsers, 'System users fetched successfully');
        return;
      } catch {
        // fallback
      }
    }

    const users = store.users.map((u) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...sanitized } = u;
      return sanitized;
    });
    ApiResponse.success(res, users, 'System users fetched successfully');
  } catch (error) {
    next(error);
  }
};
