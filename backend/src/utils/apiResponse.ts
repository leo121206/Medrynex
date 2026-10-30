import { Response } from 'express';

// Ensure Prisma BigInt fields (e.g. onChainBlockNumber) serialize cleanly in Express res.json()
if (typeof (BigInt.prototype as any).toJSON !== 'function') {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
}

export interface ApiResponsePayload<T> {
  success: boolean;
  message?: string;
  data?: T;
  meta?: Record<string, unknown>;
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message: string = 'Success',
    statusCode: number = 200,
    meta?: Record<string, unknown>
  ): Response {
    const payload: ApiResponsePayload<T> = {
      success: true,
      message,
      data,
      ...(meta ? { meta } : {}),
    };
    return res.status(statusCode).json(payload);
  }

  static created<T>(
    res: Response,
    data: T,
    message: string = 'Created successfully',
    meta?: Record<string, unknown>
  ): Response {
    return ApiResponse.success(res, data, message, 201, meta);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }
}
