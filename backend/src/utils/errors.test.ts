import { describe, it, expect } from 'vitest';
import { AppError, ErrorCode, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, DuplicateError, RateLimitError } from '../utils/errors';

describe('Error Classes', () => {
  it('should create ValidationError with fields', () => {
    const error = new ValidationError('Invalid data', { field1: 'error1' });
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.fields).toEqual({ field1: 'error1' });
  });

  it('should create AuthenticationError with default message', () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
    expect(error.errorCode).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
    expect(error.message).toBe('Authentication required');
  });

  it('should create AuthorizationError with default message', () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
    expect(error.errorCode).toBe(ErrorCode.AUTHORIZATION_DENIED);
    expect(error.message).toBe('Access denied');
  });

  it('should create NotFoundError with resource name', () => {
    const error = new NotFoundError('Report');
    expect(error.statusCode).toBe(404);
    expect(error.errorCode).toBe(ErrorCode.NOT_FOUND);
    expect(error.message).toBe('Report not found');
  });

  it('should create DuplicateError', () => {
    const error = new DuplicateError('Report already exists');
    expect(error.statusCode).toBe(409);
    expect(error.errorCode).toBe(ErrorCode.DUPLICATE_ENTRY);
  });

  it('should create RateLimitError', () => {
    const error = new RateLimitError();
    expect(error.statusCode).toBe(429);
    expect(error.errorCode).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
  });

  it('should be instance of Error', () => {
    const error = new AppError(500, ErrorCode.INTERNAL_ERROR, 'test');
    expect(error).toBeInstanceOf(Error);
  });
});
