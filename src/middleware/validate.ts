import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../common/errors.js';

type Source = 'body' | 'params' | 'query';

export function validate<T>(schema: ZodType<T>, source: Source): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.safeParse(request[source]);
    if (!parsed.success) {
      next(new AppError(400, 'VALIDATION_ERROR', parsed.error.issues.map((issue) => issue.message).join('; ')));
      return;
    }
    Object.assign(request, { [source]: parsed.data });
    next();
  };
}
