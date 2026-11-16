import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { cart, seedPricingData } from './helpers/fixtures';

let app: Express;
let customer: TestUser;
let admin: TestUser;
const LIST = '/api/v1/admin/audits';

beforeAll(async () => {
  await openDatabase('test_authz');
  await seedPricingData();
  app = buildApp();
  customer = await createTestUser(app, 'customer', 'cust');
  admin = await createTestUser(app, 'admin', 'adm');
  await request(app)
    .post('/api/v1/pricing/calculate')
    .set(...bearer(customer.token))
    .send(cart);
});
afterAll(closeDatabase);

describe('admin endpoint [DoD-7]', () => {
  it('forbids customers', async () => {
    const res = await request(app)
      .get(LIST)
      .set(...bearer(customer.token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lists audits for admins, honoring limit and userId', async () => {
    const all = await request(app)
      .get(LIST)
      .set(...bearer(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.data.length).toBeGreaterThanOrEqual(1);
    const mine = await request(app)
      .get(`${LIST}?userId=${customer.id}&limit=1`)
      .set(...bearer(admin.token));
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].context.userId).toBe(customer.id);
    const none = await request(app)
      .get(`${LIST}?userId=nobody`)
      .set(...bearer(admin.token));
    expect(none.body.data).toEqual([]);
  });

  it('rejects limit above 100', async () => {
    const res = await request(app)
      .get(`${LIST}?limit=101`)
      .set(...bearer(admin.token));
    expect(res.status).toBe(400);
  });
});

describe('public vs protected endpoints [DoD-10]', () => {
  it('returns 401 without a token on protected routes', async () => {
    const calls = [
      request(app).post('/api/v1/pricing/calculate').send(cart),
      request(app).get('/api/v1/pricing/audit/00000000-0000-4000-8000-000000000000'),
      request(app).post('/api/v1/coupons/apply').send({ code: 'A', cartId: 'c', subtotal: 1 }),
      request(app).get(LIST),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
    }
  });

  it('serves health, register and login without a token', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'public@example.com', password: customer.password });
    expect(reg.status).toBe(201);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'public@example.com', password: customer.password });
    expect(login.status).toBe(200);
  });
});
