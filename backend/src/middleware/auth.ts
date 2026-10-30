import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { verifyToken } from '../utils/jwt';

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader) {
    if (!authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication token missing or invalid format. Use Bearer <token>');
    }
    token = authHeader.split(' ')[1];
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  } else if (req.headers.cookie) {
    const match = req.headers.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('medrynx_access_token='));
    if (match) {
      token = decodeURIComponent(match.slice('medrynx_access_token='.length));
    }
  }

  if (!token) {
    throw ApiError.unauthorized('Authentication token missing or invalid format. Use Bearer <token>');
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      patientId: decoded.patientId,
      doctorId: decoded.doctorId,
      adminId: decoded.adminId,
      hospital: decoded.hospital,
    };
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Authentication token has expired. Please log in again.');
    }
    throw ApiError.unauthorized('Invalid authentication token');
  }
};
