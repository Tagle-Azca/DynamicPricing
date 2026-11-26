import request from 'supertest';
import type { Express } from 'express';
import { bearer } from './users';
import type { TestUser } from './users';
import { cart } from './fixtures';

export function calculate(
  app: Express,
  user: TestUser,
  cartId: string,
  extra: Record<string, unknown> = {},
): request.Test {
  return request(app)
    .post('/api/v1/pricing/calculate')
    .set(...bearer(user.token))
    .send({ ...cart, cartId, ...extra });
}

/** Calculates a cart (no coupon) and returns its auditId. */
export async function newAudit(app: Express, user: TestUser, cartId: string): Promise<string> {
  const res = await calculate(app, user, cartId);
  return String(res.body.data.auditId);
}

export function apply(app: Express, user: TestUser, code: string, auditId: string): request.Test {
  return request(app)
    .post('/api/v1/coupons/apply')
    .set(...bearer(user.token))
    .send({ code, auditId });
}
