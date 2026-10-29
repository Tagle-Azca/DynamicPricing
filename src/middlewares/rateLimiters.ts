import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response, RequestHandler } from 'express';
import type { AppConfig } from '../config/appConfig';

export interface Limiters {
  global: RequestHandler;
  auth: RequestHandler;
  coupon: RequestHandler;
}

function limited(_req: Request, res: Response): void {
  res.status(429).json({
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please retry later' },
  });
}

function build(
  windowMs: number,
  limit: number,
  keyGenerator?: (req: Request) => string,
): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limited,
    ...(keyGenerator ? { keyGenerator } : {}),
  });
}

function keyBySubject(req: Request): string {
  return req.auth ? `sub:${req.auth.sub}` : ipKeyGenerator(req.ip ?? '');
}

export function createLimiters(cfg: AppConfig): Limiters {
  return {
    global: build(cfg.rateLimitWindowMs, cfg.rateLimitMax),
    auth: build(cfg.rateLimitWindowMs, cfg.rateLimitAuthMax),
    coupon: build(cfg.rateLimitWindowMs, cfg.rateLimitCouponMax, keyBySubject),
  };
}
