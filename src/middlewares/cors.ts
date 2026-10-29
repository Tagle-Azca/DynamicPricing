import cors from 'cors';
import type { RequestHandler } from 'express';

export function createCors(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return cors({
    origin: (origin, callback): void => {
      callback(null, origin === undefined || allowed.has(origin));
    },
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });
}
