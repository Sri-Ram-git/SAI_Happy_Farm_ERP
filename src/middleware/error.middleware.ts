import { Request, Response, NextFunction } from 'express';
import { AppError, InternalError } from '../utils/errors';
import { logger } from '../utils/logger';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof AppError) {
    const statusCode = err.statusCode;
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
      },
    };

    if (err.fields) {
      response.error.fields = err.fields;
    }

    logger.warn('Request error', {
      requestId,
      userId: req.user?.uid,
      statusCode,
      errorCode: err.errorCode,
      message: err.message,
      method: req.method,
      endpoint: req.originalUrl,
    });

    res.status(statusCode).json(response);
    return;
  }

  logger.error('Unhandled error', {
    requestId,
    userId: req.user?.uid,
    method: req.method,
    endpoint: req.originalUrl,
    errorName: err.name,
    errorMessage: err.message,
  });

  const internalError = new InternalError();
  res.status(500).json({
    success: false,
    error: {
      code: internalError.errorCode,
      message: internalError.message,
    },
  });
}
