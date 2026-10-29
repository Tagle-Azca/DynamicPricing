import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { seedPricingData } from './helpers/fixtures';

let app: Express;
let userA: TestUser;
let userB: TestUser;
const APPLY = '/api/v1/coupons/apply';

beforeAll(async () => {
  await openDatabase('test_ratelimit');
  await seedPricingData();
  app = buildApp({ rateLimitCouponMax: 3 });
  userA = await createTestUser(app, 'customer', 'rla');
  userB = await createTestUser(app, 'customer', 'rlb');
});
afterAll(closeDatabase);

describe('rate limiting [DoD-15]', () => {
  it('limits coupon apply per user and leaves other users unaffected', async () => {
    const apply = (u: TestUser, n: number): Promise<request.Response> =>
      request(app)
        .post(APPLY)
        .set(...bearer(u.token))
        .send({ code: 'WELCOME10', cartId: `rl-${u.id}-${n}`, subtotal: 20000 });
    for (let i = 0; i < 3; i++) expect((await apply(userA, i)).status).toBe(200);
    const blocked = await apply(userA, 3);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.headers['ratelimit']).toBeDefined();
    expect((await apply(userB, 0)).status).toBe(200);
  });

  it('limits login attempts', async () => {
    const fresh = buildApp({ rateLimitAuthMax: 4 });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(fresh)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password-123' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 4).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(4)).toEqual([429, 429]);
  });
});
