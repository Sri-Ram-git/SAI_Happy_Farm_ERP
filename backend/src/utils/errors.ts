export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  AUTHENTICATION_INVALID = 'AUTHENTICATION_INVALID',
  AUTHORIZATION_DENIED = 'AUTHORIZATION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  FARM_NOT_FOUND = 'FARM_NOT_FOUND',
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly fields?: Record<string, string>;

  constructor(
    statusCode: number,
    errorCode: ErrorCode,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.fields = fields;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super(400, ErrorCode.VALIDATION_ERROR, message, fields);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, ErrorCode.AUTHENTICATION_REQUIRED, message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(403, ErrorCode.AUTHORIZATION_DENIED, message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, ErrorCode.NOT_FOUND, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class DuplicateError extends AppError {
  constructor(message: string) {
    super(409, ErrorCode.DUPLICATE_ENTRY, message);
    this.name = 'DuplicateError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(429, ErrorCode.RATE_LIMIT_EXCEEDED, message);
    this.name = 'RateLimitError';
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(500, ErrorCode.INTERNAL_ERROR, message);
    this.name = 'InternalError';
  }
}
