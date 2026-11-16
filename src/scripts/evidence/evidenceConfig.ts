import { randomBytes } from 'node:crypto';
import { appConfigFromEnv } from '../../config/appConfig';
import type { AppConfig } from '../../config/appConfig';
import { loadEnv } from '../../config/env';

export function ensureEvidenceSecret(): void {
  process.env.JWT_SECRET ??= randomBytes(32).toString('hex');
}

export function evidenceConfig(mongoUri: string): AppConfig {
  const env = loadEnv({
    ...process.env,
    MONGODB_URI: mongoUri,
    RATE_LIMIT_MAX: '100000',
    RATE_LIMIT_AUTH_MAX: '1000',
    RATE_LIMIT_COUPON_MAX: '1000',
  });
  return appConfigFromEnv(env);
}
