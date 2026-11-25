import 'dotenv/config';
import { z } from 'zod';

function parseOrigins(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function isAbsoluteOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
  } catch {
    return false;
  }
}

const corsOrigins = z
  .string()
  .default('')
  .transform(parseOrigins)
  .refine((list) => list.every(isAbsoluteOrigin), {
    message: 'CORS_ORIGINS must be comma-separated http(s) origins (no "*", no paths)',
  });

const optional = <T extends z.ZodTypeAny>(schema: T): z.ZodType<z.output<T> | undefined> =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const positiveInt = (def: number): z.ZodDefault<z.ZodCoercedNumber> =>
  z.coerce.number().int().min(1).default(def);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  JWT_ISSUER: z.string().min(1).default('dynamic-pricing-api'),
  JWT_AUDIENCE: z.string().min(1).default('dynamic-pricing-clients'),
  CORS_ORIGINS: corsOrigins,
  RATE_LIMIT_WINDOW_MS: positiveInt(60000),
  RATE_LIMIT_MAX: positiveInt(100),
  RATE_LIMIT_AUTH_MAX: positiveInt(10),
  RATE_LIMIT_COUPON_MAX: positiveInt(10),
  RESERVATION_TTL_SECONDS: z.coerce.number().int().min(1).max(86400).default(900),
  AUDIT_QUOTE_TTL_SECONDS: z.coerce.number().int().min(1).max(86400).default(900),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SEED_ADMIN_EMAIL: optional(z.string().email()),
  SEED_ADMIN_PASSWORD: optional(z.string().min(12)),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
