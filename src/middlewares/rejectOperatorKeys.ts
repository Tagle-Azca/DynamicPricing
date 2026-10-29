import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

const MAX_DEPTH = 20;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isForbiddenKey(key: string): boolean {
  return key.includes('$') || key.includes('.') || FORBIDDEN_KEYS.has(key);
}

function hasForbiddenKey(value: unknown, depth: number): boolean {
  if (depth > MAX_DEPTH) return true;
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((v) => hasForbiddenKey(v, depth + 1));
  return Object.keys(value).some(
    (key) =>
      isForbiddenKey(key) || hasForbiddenKey((value as Record<string, unknown>)[key], depth + 1),
  );
}

/** Defense in depth against NoSQL operator injection; Zod types and sanitizeFilter back it up. */
export function rejectOperatorKeys(req: Request, _res: Response, next: NextFunction): void {
  if ([req.body, req.query, req.params].some((part) => hasForbiddenKey(part, 0))) {
    next(new AppError(400, 'INVALID_INPUT', 'Request contains forbidden keys'));
    return;
  }
  next();
}
