import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../common/errors.js';

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  console.error({ error, method: request.method, path: request.path }, 'Request failed');
  void next;
  const candidate = error as { statusCode?: number; message?: string; code?: string };
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
    return;
  }
  if (candidate.statusCode === 429) {
    response.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: candidate.message ?? 'Rate limit exceeded. Retry later.' },
    });
    return;
  }
  const statusCode = candidate.statusCode && candidate.statusCode >= 400 && candidate.statusCode < 500
    ? candidate.statusCode : 500;
  response.status(statusCode).json({
    success: false,
    error: {
      code: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
      message: statusCode >= 500 ? 'An unexpected error occurred.' : candidate.message ?? 'Request failed.',
    },
  });
};
