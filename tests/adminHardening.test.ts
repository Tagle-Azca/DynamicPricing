import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { cart, seedPricingData } from './helpers/fixtures';
import { calculatePricing } from '../src/services/pricing.service';
import { exportAudits } from '../src/services/audit.query.service';
import { auditsToCsv } from '../src/services/audit.csv';
import type { AuditSnapshot } from '../src/dtos/audit.dto';

let app: Express;
let admin: TestUser;
let alice: TestUser;
const A = '/api/v1/admin';

const base = {
  name: 'Hardening',
  type: 'percentage',
  value: 10,
  startsAt: '2020-01-01T00:00:00Z',
  endsAt: '2099-01-01T00:00:00Z',
};

beforeAll(async () => {
  await openDatabase('test_admin_hardening');
  await seedPricingData();
  app = buildApp();
  admin = await createTestUser(app, 'admin', 'root');
  alice = await createTestUser(app, 'customer', 'alice');
});
afterAll(closeDatabase);

function post(path: string, body: unknown): request.Test {
  return request(app)
    .post(path)
    .set(...bearer(admin.token))
    .send(body as object);
}

describe('input validation', () => {
  it('S5: whitespace-only codes are 400, not 500', async () => {
    expect((await post(`${A}/campaigns`, { ...base, code: '   ' })).status).toBe(400);
    const coupon = { discountType: 'fixed', value: 5, maxUses: 1, expiresAt: '2099-01-01' };
    expect((await post(`${A}/coupons`, { ...coupon, code: '  ' })).status).toBe(400);
  });

  it('S6: null, boolean and numeric dates are rejected; ISO strings pass', async () => {
    for (const bad of [null, true, 0]) {
      const res = await post(`${A}/campaigns`, { ...base, code: 'D1', startsAt: bad });
      expect(res.status).toBe(400);
    }
    const patch = await request(app)
      .patch(`${A}/coupons/WELCOME10`)
      .set(...bearer(admin.token))
      .send({ expiresAt: null });
    expect(patch.status).toBe(400);
    expect((await post(`${A}/campaigns`, { ...base, code: 'D2' })).status).toBe(201);
  });

  it('S6/S10: export rejects garbage dates and from > to', async () => {
    const get = (q: string): request.Test =>
      request(app)
        .get(`${A}/audits/export?${q}`)
        .set(...bearer(admin.token));
    expect((await get('from=garbage')).status).toBe(400);
    expect((await get('from=2030-01-01&to=2020-01-01')).status).toBe(400);
  });

  it('S7: quantity and unitPrice are capped', async () => {
    const send = (item: object): request.Test =>
      request(app)
        .post('/api/v1/pricing/calculate')
        .set(...bearer(alice.token))
        .send({
          ...cart,
          items: [{ sku: 'S', category: 'c', unitPrice: 1, quantity: 1, ...item }],
        });
    expect((await send({ quantity: 10001 })).status).toBe(400);
    expect((await send({ unitPrice: 1_000_000_001 })).status).toBe(400);
    expect((await send({ unitPrice: 1_000_000_000, quantity: 10000 })).status).toBe(200);
  });

  it('S7: calculatePricing rejects an unsafe subtotal with 422 AMOUNT_TOO_LARGE', async () => {
    const huge = { ...cart, items: [{ ...cart.items[0]!, unitPrice: 9e15, quantity: 2 }] };
    await expect(calculatePricing(huge as never)).rejects.toMatchObject({
      statusCode: 422,
      code: 'AMOUNT_TOO_LARGE',
    });
  });
});

describe('catalog behaviour', () => {
  it('S11: trims regions and merges PATCH conditions field by field', async () => {
    const created = await post(`${A}/campaigns`, {
      ...base,
      code: 'REG',
      conditions: { regions: [' cn '], minSubtotal: 100 },
    });
    expect(created.body.data.conditions.regions).toEqual(['CN']);
    expect(
      (await post(`${A}/campaigns`, { ...base, code: 'REG2', conditions: { regions: ['USA'] } }))
        .status,
    ).toBe(400);
    const patch = (conditions: object): request.Test =>
      request(app)
        .patch(`${A}/campaigns/REG`)
        .set(...bearer(admin.token))
        .send({ conditions });
    const kept = await patch({ regions: [' us'] });
    expect(kept.body.data.conditions).toEqual({ regions: ['US'], minSubtotal: 100 });
    const cleared = await patch({ minSubtotal: null });
    expect(cleared.body.data.conditions).toEqual({ regions: ['US'] });
  });

  it('S12: CORS preflight allows PATCH', async () => {
    const cors = buildApp({ corsOrigins: ['https://admin.example.com'] });
    const res = await request(cors)
      .options(`${A}/campaigns/REG`)
      .set('Origin', 'https://admin.example.com')
      .set('Access-Control-Request-Method', 'PATCH');
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
  });
});

describe('coupon ownership and export', () => {
  it('S9: a coupon bound to someone else looks like an unknown code, even when inactive', async () => {
    const bob = await createTestUser(app, 'customer', 'bob');
    await post(`${A}/coupons`, {
      code: 'ONLYALICE',
      discountType: 'fixed',
      value: 5,
      maxUses: 1,
      expiresAt: '2099-01-01',
      isActive: false,
      userId: alice.id,
    });
    const res = await request(app)
      .post('/api/v1/coupons/apply')
      .set(...bearer(bob.token))
      .send({ code: 'ONLYALICE', cartId: 'x', subtotal: 1000 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COUPON_NOT_FOUND');
  });

  it('S10: export over the row limit is 422 EXPORT_TOO_LARGE', async () => {
    for (const id of ['e1', 'e2', 'e3']) {
      await request(app)
        .post('/api/v1/pricing/calculate')
        .set(...bearer(alice.token))
        .send({ ...cart, cartId: id });
    }
    await expect(exportAudits({ format: 'json' }, 2)).rejects.toMatchObject({
      statusCode: 422,
      code: 'EXPORT_TOO_LARGE',
    });
    const all = await exportAudits({ format: 'json' }, 1000);
    expect(all.length).toBeGreaterThanOrEqual(3);
  });
});

describe('S8: CSV hardening', () => {
  function row(cartId: string): AuditSnapshot & { checksumValid: boolean } {
    return {
      createdAt: new Date(0),
      auditId: 'id',
      cartId,
      context: { userId: 'u', region: 'US' },
      result: { currency: 'USD', subtotal: 1, appliedRules: [], totalDiscount: 0, total: 1 },
      checksum: 'c',
      checksumValid: true,
    } as unknown as AuditSnapshot & { checksumValid: boolean };
  }

  it('neutralises formula starters, quotes CR and strips control chars', () => {
    const csv = auditsToCsv([row('=1+1'), row('\t=1+1'), row('a\r=1+1'), row('x\u0007y')]);
    expect(csv).toContain(",'=1+1,");
    expect(csv).toContain(",'\t=1+1,");
    expect(csv).toContain(',"a\r=1+1",');
    expect(csv).toContain(',xy,');
  });

  it('sends an attachment Content-Disposition for csv', async () => {
    const res = await request(app)
      .get(`${A}/audits/export?format=csv`)
      .set(...bearer(admin.token));
    expect(res.headers['content-disposition']).toBe('attachment; filename="audits.csv"');
  });
});
