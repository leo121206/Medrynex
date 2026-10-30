import { Request, Response, NextFunction } from 'express';
import { checkSystemHealth, checkLiveness, checkReadiness, checkDependencyHealth } from '../services/health.service';
import { ApiResponse } from '../utils/apiResponse';

export const getHealth = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const health = await checkSystemHealth();
    ApiResponse.success(res, health, 'System is operational');
  } catch (error) {
    next(error);
  }
};

export const getLiveness = (
  _req: Request,
  res: Response
): void => {
  const liveness = checkLiveness();
  res.status(200).json({
    success: true,
    data: liveness,
  });
};

export const getReadiness = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const readiness = await checkReadiness();
    const statusCode = readiness.status === 'READY' ? 200 : 503;
    res.status(statusCode).json({
      success: readiness.status === 'READY',
      data: readiness,
    });
  } catch (error) {
    next(error);
  }
};

export const getDependencies = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const detailed = await checkDependencyHealth();
    const statusCode = detailed.status === 'UNHEALTHY' ? 503 : 200;
    res.status(statusCode).json({
      success: detailed.status !== 'UNHEALTHY',
      data: detailed,
    });
  } catch (error) {
    next(error);
  }
};
