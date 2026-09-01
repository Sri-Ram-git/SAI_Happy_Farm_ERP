import { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../utils/errors';
import { getEnv } from '../config/environment';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const requestCounts = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts.entries()) {
    if (now > entry.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 60000);

export function rateLimitMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const env = getEnv();
  const windowMs = env.RATE_LIMIT_WINDOW_MS;
  const maxRequests = env.RATE_LIMIT_MAX_REQUESTS;

  const clientId = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();

  let entry = requestCounts.get(clientId);

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs };
    requestCounts.set(clientId, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    next(new RateLimitError('Rate limit exceeded'));
    return;
  }

  next();
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
  const localCounts = new Map<string, RateLimitEntry>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of localCounts.entries()) {
      if (now > entry.resetTime) {
        localCounts.delete(key);
      }
    }
  }, 60000);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const clientId = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();

    let entry = localCounts.get(clientId);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      localCounts.set(clientId, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      next(new RateLimitError('Rate limit exceeded for this endpoint'));
      return;
    }

    next();
  };
}
