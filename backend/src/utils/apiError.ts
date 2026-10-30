export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    errorCode: string = 'INTERNAL_ERROR',
    details?: unknown,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errorCode: string = 'BAD_REQUEST', details?: unknown): ApiError {
    return new ApiError(400, message, errorCode, details);
  }

  static unauthorized(message: string = 'Unauthorized access', errorCode: string = 'UNAUTHORIZED'): ApiError {
    return new ApiError(401, message, errorCode);
  }

  static forbidden(message: string = 'Forbidden - Insufficient permissions', errorCode: string = 'FORBIDDEN'): ApiError {
    return new ApiError(403, message, errorCode);
  }

  static notFound(message: string = 'Resource not found', errorCode: string = 'NOT_FOUND'): ApiError {
    return new ApiError(404, message, errorCode);
  }

  static conflict(message: string, errorCode: string = 'CONFLICT'): ApiError {
    return new ApiError(409, message, errorCode);
  }

  static unprocessable(message: string, errorCode: string = 'UNPROCESSABLE_ENTITY', details?: unknown): ApiError {
    return new ApiError(422, message, errorCode, details);
  }

  static internal(message: string = 'Internal server error', errorCode: string = 'INTERNAL_SERVER_ERROR'): ApiError {
    return new ApiError(500, message, errorCode, undefined, false);
  }
}
