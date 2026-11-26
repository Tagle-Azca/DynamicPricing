import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { seedPricingData } from './helpers/fixtures';
import { apply, calculate, newAudit } from './helpers/pricing';
import { createCoupon, remaining } from './helpers/coupons';
import { CouponReservation } from '../src/models/couponReservation.model';
import { PricingAudit } from '../src/models/pricingAudit.model';

let app: Express;
let alice: TestUser;
let admin: TestUser;

beforeAll(async () => {
  await openDatabase('test_coupon_guards');
  await seedPricingData();
  app = buildApp({ auditQuoteTtlSeconds: 60 });
  alice = await createTestUser(app, 'customer', 'alice');
  admin = await createTestUser(app, 'admin', 'root');
});
afterAll(closeDatabase);

const code = (res: request.Response): string => String(res.body.error?.code);

describe('one active coupon per audit and cart [S1]', () => {
  it('rejects a second coupon on the same audit', async () => {
    await createCoupon('STK1');
    await createCoupon('STK2');
    const id = await newAudit(app, alice, 'stk-audit');
    expect((await apply(app, alice, 'STK1', id)).status).toBe(201);
    const second = await apply(app, alice, 'STK2', id);
    expect(second.status).toBe(409);
    expect(code(second)).toBe('COUPON_ALREADY_APPLIED');
    expect(await remaining('STK2')).toBe(10);
  });

  it('rejects a second coupon on a fresh audit of the same cart', async () => {
    await createCoupon('STK3');
    await createCoupon('STK4');
    expect((await apply(app, alice, 'STK3', await newAudit(app, alice, 'stk-cart'))).status).toBe(
      201,
    );
    const again = await apply(app, alice, 'STK4', await newAudit(app, alice, 'stk-cart'));
    expect(code(again)).toBe('COUPON_ALREADY_APPLIED');
  });

  it('calculate with couponCode then apply with another code on the cart is 409', async () => {
    await createCoupon('STK5');
    await createCoupon('STK6');
    const calc = await calculate(app, alice, 'stk-calc', { couponCode: 'STK5' });
    expect(calc.status).toBe(200);
    const fresh = await newAudit(app, alice, 'stk-calc');
    const res = await apply(app, alice, 'STK6', fresh);
    expect(res.status).toBe(409);
    expect(code(res)).toBe('COUPON_ALREADY_APPLIED');
    const second = await calculate(app, alice, 'stk-calc', { couponCode: 'STK6' });
    expect(code(second)).toBe('COUPON_ALREADY_APPLIED');
    expect(await remaining('STK6')).toBe(10);
  });

  it('parallel applies of different coupons on one audit give exactly one 201', async () => {
    const codes = Array.from({ length: 8 }, (_, i) => `RACE${i}`);
    for (const c of codes) await createCoupon(c, { perUserLimit: 5 });
    const id = await newAudit(app, alice, 'stk-race');
    const results = await Promise.all(codes.map((c) => apply(app, alice, c, id)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const rest = results.filter((r) => r.status !== 201);
    expect(rest.every((r) => r.status === 409 && code(r) === 'COUPON_ALREADY_APPLIED')).toBe(true);
    expect(await CouponReservation.countDocuments({ cartId: 'stk-race' })).toBe(1);
    let total = 0;
    for (const c of codes) total += 10 - (await remaining(c));
    expect(total).toBe(1);
  });

  it('releasing the reservation frees the slot', async () => {
    await createCoupon('FREE1');
    await createCoupon('FREE2');
    const id = await newAudit(app, alice, 'stk-free');
    const first = await apply(app, alice, 'FREE1', id);
    const del = await request(app)
      .delete(`/api/v1/coupons/reservations/${String(first.body.data.reservationId)}`)
      .set(...bearer(alice.token));
    expect(del.status).toBe(200);
    expect((await apply(app, alice, 'FREE2', id)).status).toBe(201);
  });
});

describe('coupon rate limit on /pricing/calculate [S3]', () => {
  it('limits calculate only when couponCode is present', async () => {
    const limited = buildApp({ rateLimitCouponMax: 3 });
    const user = await createTestUser(limited, 'customer', 'rl');
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      statuses.push(
        (await calculate(limited, user, `rl-${i}`, { couponCode: `GUESS${i}` })).status,
      );
    }
    expect(statuses).toEqual([404, 404, 404, 429, 429]);
    expect((await calculate(limited, user, 'rl-plain')).status).toBe(200);
  });
});

describe('currency handling [S4]', () => {
  const adminPost = (url: string, body: object): request.Test =>
    request(app)
      .post(url)
      .set(...bearer(admin.token))
      .send(body);

  it('rejects malformed currency on products and context, uppercases valid ones', async () => {
    const product = { name: 'Thing', category: 'x', unitPrice: 1000 };
    for (const currency of ['<s>', 'U$D', '12A', 'USDX', 'us']) {
      const res = await adminPost('/api/v1/admin/products', {
        sku: 'BADCUR',
        ...product,
        currency,
      });
      expect(res.status).toBe(400);
    }
    const ok = await adminPost('/api/v1/admin/products', {
      sku: 'EUR-1',
      ...product,
      currency: 'eur',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.data.currency).toBe('EUR');
    const ctx = await calculate(app, alice, 'cur-ctx', {
      context: { currency: '<S>' },
    });
    expect(ctx.status).toBe(400);
  });

  it('admin can set and patch coupon currency with the same validation', async () => {
    const body = {
      code: 'EURC',
      discountType: 'fixed',
      value: 500,
      maxUses: 5,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    const bad = await adminPost('/api/v1/admin/coupons', { ...body, currency: 'EU' });
    expect(bad.status).toBe(400);
    const made = await adminPost('/api/v1/admin/coupons', { ...body, currency: 'eur' });
    expect(made.status).toBe(201);
    expect(made.body.data.currency).toBe('EUR');
    const usd = await adminPost('/api/v1/admin/coupons', { ...body, code: 'USDC' });
    expect(usd.body.data.currency).toBe('USD');
    const patched = await request(app)
      .patch('/api/v1/admin/coupons/USDC')
      .set(...bearer(admin.token))
      .send({ currency: 'jpy' });
    expect(patched.body.data.currency).toBe('JPY');
  });

  it('a coupon in another currency is 422 CURRENCY_MISMATCH on calculate and apply', async () => {
    await createCoupon('EURONLY', { currency: 'EUR' });
    const id = await newAudit(app, alice, 'cur-apply');
    const viaApply = await apply(app, alice, 'EURONLY', id);
    expect(viaApply.status).toBe(422);
    expect(code(viaApply)).toBe('CURRENCY_MISMATCH');
    const viaCalc = await calculate(app, alice, 'cur-calc', { couponCode: 'EURONLY' });
    expect(viaCalc.status).toBe(422);
    expect(code(viaCalc)).toBe('CURRENCY_MISMATCH');
    expect(await remaining('EURONLY')).toBe(10);
  });
});

describe('stale audits [S5]', () => {
  it('apply rejects an audit older than AUDIT_QUOTE_TTL_SECONDS with 409 AUDIT_STALE', async () => {
    await createCoupon('STALE1');
    const id = await newAudit(app, alice, 'stale-1');
    await PricingAudit.collection.updateOne(
      { auditId: id },
      { $set: { createdAt: new Date(Date.now() - 61_000) } },
    );
    const res = await apply(app, alice, 'STALE1', id);
    expect(res.status).toBe(409);
    expect(code(res)).toBe('AUDIT_STALE');
    expect(await remaining('STALE1')).toBe(10);
    expect((await apply(app, alice, 'STALE1', await newAudit(app, alice, 'stale-1'))).status).toBe(
      201,
    );
  });
});
