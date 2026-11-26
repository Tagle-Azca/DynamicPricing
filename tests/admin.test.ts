import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { cart, seedPricingData } from './helpers/fixtures';
import { apply, newAudit } from './helpers/pricing';
import { PricingAudit } from '../src/models/pricingAudit.model';

let app: Express;
let admin: TestUser;
let alice: TestUser;
const A = '/api/v1/admin';

const campaign = {
  code: 'cny-test',
  name: 'CNY test',
  type: 'percentage',
  value: 20,
  priority: 70,
  startsAt: '2020-01-01T00:00:00Z',
  endsAt: '2099-01-01T00:00:00Z',
  conditions: { regions: ['cn'] },
};

beforeAll(async () => {
  await openDatabase('test_admin');
  await seedPricingData();
  app = buildApp();
  admin = await createTestUser(app, 'admin', 'root');
  alice = await createTestUser(app, 'customer', 'alice');
});
afterAll(closeDatabase);

describe('admin campaigns', () => {
  it('rejects customers with 403', async () => {
    const res = await request(app)
      .post(`${A}/campaigns`)
      .set(...bearer(alice.token))
      .send(campaign);
    expect(res.status).toBe(403);
  });

  it('creates a regional campaign (201) and normalises code and region', async () => {
    const res = await request(app)
      .post(`${A}/campaigns`)
      .set(...bearer(admin.token))
      .send(campaign);
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('CNY-TEST');
    expect(res.body.data.conditions.regions).toEqual(['CN']);
  });

  it('409 on duplicate code, 400 on invalid dates or percentage over 100', async () => {
    const dup = await request(app)
      .post(`${A}/campaigns`)
      .set(...bearer(admin.token))
      .send(campaign);
    expect(dup.status).toBe(409);
    const badDates = await request(app)
      .post(`${A}/campaigns`)
      .set(...bearer(admin.token))
      .send({ ...campaign, code: 'X1', startsAt: '2030-01-01', endsAt: '2029-01-01' });
    expect(badDates.status).toBe(400);
    const badPct = await request(app)
      .post(`${A}/campaigns`)
      .set(...bearer(admin.token))
      .send({ ...campaign, code: 'X2', value: 150 });
    expect(badPct.status).toBe(400);
  });

  it('region condition: applies for CN, skipped with REGION_NOT_ELIGIBLE otherwise', async () => {
    const cn = await request(app)
      .post('/api/v1/pricing/calculate')
      .set(...bearer(alice.token))
      .send({ ...cart, context: { ...cart.context, region: 'cn' } });
    expect(cn.body.data.appliedRules.map((r: { code: string }) => r.code)).toContain('CNY-TEST');
    const mx = await request(app)
      .post('/api/v1/pricing/calculate')
      .set(...bearer(alice.token))
      .send({ ...cart, context: { ...cart.context, region: 'MX' } });
    expect(mx.body.data.skippedRules).toContainEqual({
      code: 'CNY-TEST',
      reason: 'REGION_NOT_ELIGIBLE',
    });
  });

  it('deactivates a campaign (PATCH) and 404s on unknown code', async () => {
    const off = await request(app)
      .patch(`${A}/campaigns/cny-test`)
      .set(...bearer(admin.token))
      .send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body.data.isActive).toBe(false);
    const missing = await request(app)
      .patch(`${A}/campaigns/NOPE`)
      .set(...bearer(admin.token))
      .send({ isActive: false });
    expect(missing.status).toBe(404);
    const list = await request(app)
      .get(`${A}/campaigns`)
      .set(...bearer(admin.token));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(3);
  });
});

describe('user-bound coupons', () => {
  it('admin creates a coupon for alice; other users get 404, alice reserves it once', async () => {
    const bob = await createTestUser(app, 'customer', 'bob');
    const created = await request(app)
      .post(`${A}/coupons`)
      .set(...bearer(admin.token))
      .send({
        code: 'alice-only',
        discountType: 'percentage',
        value: 10,
        maxUses: 1,
        expiresAt: '2099-01-01T00:00:00Z',
        userId: alice.id,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.remainingUses).toBe(1);

    const bobAudit = await newAudit(app, bob, 'c-1');
    const denied = await apply(app, bob, 'ALICE-ONLY', bobAudit);
    expect(denied.status).toBe(404);
    expect(denied.body.error.code).toBe('COUPON_NOT_FOUND');

    const ok = await apply(app, alice, 'ALICE-ONLY', await newAudit(app, alice, 'c-1a'));
    expect(ok.status).toBe(201);
    expect(ok.body.data.remainingUses).toBe(0);

    const again = await apply(app, alice, 'ALICE-ONLY', await newAudit(app, alice, 'c-2'));
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('COUPON_EXHAUSTED');
  });

  it('admin can deactivate a coupon', async () => {
    const res = await request(app)
      .patch(`${A}/coupons/welcome10`)
      .set(...bearer(admin.token))
      .send({ isActive: false });
    expect(res.status).toBe(200);
    const res2 = await apply(app, alice, 'WELCOME10', await newAudit(app, alice, 'c-3'));
    expect(res2.body.error.code).toBe('COUPON_UNAVAILABLE');
  });
});

describe('admin audit backup', () => {
  let auditId: string;
  it('get by id returns checksumValid true, then false after tampering outside Mongoose', async () => {
    const calc = await request(app)
      .post('/api/v1/pricing/calculate')
      .set(...bearer(alice.token))
      .send(cart);
    auditId = calc.body.data.auditId;
    const ok = await request(app)
      .get(`${A}/audits/${auditId}`)
      .set(...bearer(admin.token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.checksumValid).toBe(true);

    await PricingAudit.collection.updateOne({ auditId }, { $set: { 'result.total': 1 } });
    const bad = await request(app)
      .get(`${A}/audits/${auditId}`)
      .set(...bearer(admin.token));
    expect(bad.body.data.checksumValid).toBe(false);
  });

  it('404 for unknown audit, 403 for customer', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    expect(
      (
        await request(app)
          .get(`${A}/audits/${id}`)
          .set(...bearer(admin.token))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`${A}/audits/${id}`)
          .set(...bearer(alice.token))
      ).status,
    ).toBe(403);
  });

  it('exports JSON and CSV with a period filter', async () => {
    const json = await request(app)
      .get(`${A}/audits/export`)
      .set(...bearer(admin.token));
    expect(json.status).toBe(200);
    expect(json.body.data.length).toBeGreaterThan(0);
    const csv = await request(app)
      .get(`${A}/audits/export?format=csv&from=2020-01-01`)
      .set(...bearer(admin.token));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\n')[0]).toContain('checksumValid');
    const none = await request(app)
      .get(`${A}/audits/export?from=2999-01-01`)
      .set(...bearer(admin.token));
    expect(none.body.data).toEqual([]);
  });
});
