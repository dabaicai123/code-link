import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { Errors } from '../core/errors/index.js';

function formatZodError(error: ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json(Errors.validationError(formatZodError(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json(Errors.validationError(formatZodError(result.error)));
      return;
    }
    req.params = result.data as Record<string, string>;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json(Errors.validationError(formatZodError(result.error)));
      return;
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
  return (req: Request, res: Response, next: NextFunction): void => {
    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        res.status(400).json(Errors.validationError(formatZodError(result.error)));
        return;
      }
      req.body = result.data;
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        res.status(400).json(Errors.validationError(formatZodError(result.error)));
        return;
      }
      req.params = result.data as Record<string, string>;
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        res.status(400).json(Errors.validationError(formatZodError(result.error)));
        return;
      }
      req.query = result.data as Record<string, any>;
    }

    next();
  };
}
