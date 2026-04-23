import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../core/errors/index.js';

function formatZodError(error: ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(formatZodError(result.error));
    }
    req.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      throw new ValidationError(formatZodError(result.error));
    }
    // Zod transforms (e.g., .transform(Number)) produce typed output —
    // cast to any to allow controllers to access the transformed values
    // without fighting Express's string-typed ParamsDictionary.
    (req as any).validatedParams = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError(formatZodError(result.error));
    }
    req.query = result.data as Record<string, any>;
    next();
  };
}

export function validate(schema: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        throw new ValidationError(formatZodError(result.error));
      }
      req.body = result.data;
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        throw new ValidationError(formatZodError(result.error));
      }
      (req as any).validatedParams = result.data;
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        throw new ValidationError(formatZodError(result.error));
      }
      req.query = result.data as Record<string, any>;
    }

    next();
  };
}