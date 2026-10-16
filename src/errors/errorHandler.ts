import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError';

interface ErrorBody {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof ZodError) {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.issues,
    };
  }
  if (err instanceof AppError) {
    return { status: err.statusCode, code: err.code, message: err.message, details: err.details };
  }
  if (isBodyParserError(err) && err.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON body' };
  }
  if (isBodyParserError(err) && err.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' };
  }
  if (isDuplicateKey(err)) {
    return { status: 409, code: 'DUPLICATE_RESOURCE', message: 'Resource already exists' };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const body = toErrorBody(err);
  if (body.status >= 500) {
    console.error('Unhandled error:', err);
  }
  const error: Record<string, unknown> = { code: body.code, message: body.message };
  if (body.details !== undefined) error.details = body.details;
  res.status(body.status).json({ error });
}
