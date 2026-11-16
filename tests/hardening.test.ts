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
const ORIGIN = 'http://allowed.test';

beforeAll(async () => {
  await openDatabase('test_hardening');
  await seedPricingData();
  app = buildApp({ corsOrigins: [ORIGIN] });
  customer = await createTestUser(app, 'customer', 'hard');
  admin = await createTestUser(app, 'admin', 'hardadm');
});
afterAll(closeDatabase);

describe('NoSQL operator rejection [DoD-11]', () => {
  it('rejects an operator object as login email without issuing a token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: { $ne: null }, password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.data).toBeUndefined();
  });

  it('rejects $-prefixed and __proto__ keys on calculate and coupon apply', async () => {
    const attempts: Array<[string, string]> = [
      ['/api/v1/pricing/calculate', JSON.stringify({ ...cart, cartId: { $gt: '' } })],
      ['/api/v1/pricing/calculate', JSON.stringify({ ...cart, $where: '1' })],
      ['/api/v1/pricing/calculate', `{"cartId":"c","items":[],"context":{},"__proto__":{"x":1}}`],
      ['/api/v1/coupons/apply', JSON.stringify({ code: { $ne: '' }, cartId: 'c', subtotal: 1 })],
      ['/api/v1/coupons/apply', `{"code":"A","cartId":"c","subtotal":1,"__proto__":{"a":1}}`],
    ];
    for (const [path, body] of attempts) {
      const res = await request(app)
        .post(path)
        .set(...bearer(customer.token))
        .set('Content-Type', 'application/json')
        .send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_INPUT');
    }
  });

  it('rejects operator syntax in the query string', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audits?userId[$ne]=x')
      .set(...bearer(admin.token));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
});

describe('body limit [DoD-12]', () => {
  it('returns 413 PAYLOAD_TOO_LARGE above 100kb', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(110 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('headers [DoD-13]', () => {
  it('sets helmet headers and hides x-powered-by', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('CORS allowlist [DoD-14]', () => {
  it('echoes an allowlisted origin, including on preflight', async () => {
    const simple = await request(app).get('/health').set('Origin', ORIGIN);
    expect(simple.headers['access-control-allow-origin']).toBe(ORIGIN);
    const preflight = await request(app)
      .options('/api/v1/pricing/calculate')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(preflight.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(preflight.status).toBeLessThan(300);
  });

  it('gives other origins no ACAO header and no 500', async () => {
    const simple = await request(app).get('/health').set('Origin', 'http://evil.test');
    expect(simple.status).toBe(200);
    expect(simple.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await request(app)
      .options('/api/v1/pricing/calculate')
      .set('Origin', 'http://evil.test')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.status).toBeLessThan(500);
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });
});
