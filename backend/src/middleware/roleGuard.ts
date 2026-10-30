import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { UserRole } from '@prisma/client';

export type AllowedRole = UserRole;

export const requireRole = (...allowedRoles: AllowedRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized('User must be authenticated before role check');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(
        `Forbidden: Role '${req.user.role}' does not have access to this resource. Required role(s): [${allowedRoles.join(', ')}]`
      );
    }

    next();
  };
};
