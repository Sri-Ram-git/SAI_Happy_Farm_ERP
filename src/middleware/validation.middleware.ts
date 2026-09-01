import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const fields: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const path = issue.path.join('.');
          fields[path || '_root'] = issue.message;
        }
        next(new ValidationError('Invalid request data', fields));
        return;
      }

      req.body = result.data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const fields: Record<string, string> = {};
        for (const issue of error.issues) {
          const path = issue.path.join('.');
          fields[path || '_root'] = issue.message;
        }
        next(new ValidationError('Invalid request data', fields));
        return;
      }
      next(error);
    }
  };
}
