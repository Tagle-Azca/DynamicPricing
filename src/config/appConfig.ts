import type { Env } from './env';

export interface AppConfig {
  jwtSecret: string;
  jwtTtlSeconds: number;
  jwtIssuer: string;
  jwtAudience: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMax: number;
  rateLimitAuthMax: number;
  rateLimitCouponMax: number;
  reservationTtlSeconds: number;
  auditQuoteTtlSeconds: number;
  bcryptRounds: number;
  trustProxy: boolean;
}

export function appConfigFromEnv(env: Env): AppConfig {
  return {
    jwtSecret: env.JWT_SECRET,
    jwtTtlSeconds: env.JWT_TTL_SECONDS,
    jwtIssuer: env.JWT_ISSUER,
    jwtAudience: env.JWT_AUDIENCE,
    corsOrigins: env.CORS_ORIGINS,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMax: env.RATE_LIMIT_MAX,
    rateLimitAuthMax: env.RATE_LIMIT_AUTH_MAX,
    rateLimitCouponMax: env.RATE_LIMIT_COUPON_MAX,
    reservationTtlSeconds: env.RESERVATION_TTL_SECONDS,
    auditQuoteTtlSeconds: env.AUDIT_QUOTE_TTL_SECONDS,
    bcryptRounds: env.BCRYPT_ROUNDS,
    trustProxy: env.TRUST_PROXY,
  };
}
