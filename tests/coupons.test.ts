import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
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
let bob: TestUser;

beforeAll(async () => {
  await openDatabase('test_coupons');
  await seedPricingData();
  app = buildApp();
  alice = await createTestUser(app, 'customer', 'alice');
  bob = await createTestUser(app, 'customer', 'bob');
});
afterAll(closeDatabase);

describe('concurrency', () => {
  it('20 parallel applies on maxUses=5 give exactly 5 successes and remainingUses 0', async () => {
    await createCoupon('PAR5', { maxUses: 5, perUserLimit: 100 });
    const audits = await Promise.all(
      Array.from({ length: 20 }, (_, i) => newAudit(app, alice, `par-${i}`)),
    );
    const results = await Promise.all(audits.map((id) => apply(app, alice, 'PAR5', id)));
    const ok = results.filter((r) => r.status === 201);
    const exhausted = results.filter(
      (r) => r.status === 409 && r.body.error.code === 'COUPON_EXHAUSTED',
    );
    expect(ok).toHaveLength(5);
    expect(exhausted).toHaveLength(15);
    expect(await remaining('PAR5')).toBe(0);
    expect(await CouponReservation.countDocuments({ couponCode: 'PAR5' })).toBe(5);
  });

  it('perUserLimit=1 holds under parallel applies by one user, another user still succeeds', async () => {
    await createCoupon('ONEEACH', { maxUses: 100, perUserLimit: 1 });
    const audits = await Promise.all(
      Array.from({ length: 10 }, (_, i) => newAudit(app, alice, `one-${i}`)),
    );
    const results = await Promise.all(audits.map((id) => apply(app, alice, 'ONEEACH', id)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const limited = results.filter((r) => r.status === 409);
    expect(limited).toHaveLength(9);
    expect(limited.every((r) => r.body.error.code === 'COUPON_LIMIT_REACHED')).toBe(true);
    expect(await remaining('ONEEACH')).toBe(99);

    const other = await apply(app, bob, 'ONEEACH', await newAudit(app, bob, 'one-bob'));
    expect(other.status).toBe(201);
    expect(await remaining('ONEEACH')).toBe(98);
  });
});

describe('calculate with couponCode', () => {
  it('returns finalTotal and coupon, reserves one use and stores the coupon in a valid audit', async () => {
    await createCoupon('CALC10', { maxUses: 3 });
    const res = await calculate(app, alice, 'calc-1', { couponCode: 'calc10' });
    expect(res.status).toBe(200);
    const { total, coupon, finalTotal, auditId } = res.body.data;
    expect(coupon.code).toBe('CALC10');
    expect(coupon.discountAmount).toBe(Math.round(total / 10));
    expect(finalTotal).toBe(total - coupon.discountAmount);
    expect(coupon.remainingUses).toBe(2);
    expect(coupon.reservationId).toMatch(/^[0-9a-f]{24}$/);
    expect(await remaining('CALC10')).toBe(2);

    const audit = await request(app)
      .get(`/api/v1/pricing/audit/${auditId}`)
      .set(...bearer(alice.token));
    expect(audit.body.data.coupon.reservationId).toBe(coupon.reservationId);
  });

  it('without a coupon finalTotal equals total', async () => {
    const res = await calculate(app, alice, 'calc-plain');
    expect(res.body.data.finalTotal).toBe(res.body.data.total);
    expect(res.body.data.coupon).toBeUndefined();
  });

  it('rolls back the reservation when the audit write fails', async () => {
    await createCoupon('ATOMIC', { maxUses: 2 });
    const spy = vi.spyOn(PricingAudit, 'create').mockRejectedValueOnce(new Error('disk full'));
    const res = await calculate(app, alice, 'atomic-1', { couponCode: 'ATOMIC' });
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(await remaining('ATOMIC')).toBe(2);
    expect(await CouponReservation.countDocuments({ couponCode: 'ATOMIC' })).toBe(0);
  });

  it('422 MIN_SUBTOTAL_NOT_MET leaves remainingUses unchanged', async () => {
    await createCoupon('MINBIG', { minSubtotal: 1_000_000 });
    const res = await calculate(app, alice, 'min-1', { couponCode: 'MINBIG' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MIN_SUBTOTAL_NOT_MET');
    expect(await remaining('MINBIG')).toBe(10);
  });

  it('409 COUPON_ALREADY_APPLIED for a different coupon on a cart that holds one', async () => {
    await createCoupon('TWICE', { perUserLimit: 5 });
    await createCoupon('OTHER', { perUserLimit: 5 });
    expect((await calculate(app, alice, 'twice-1', { couponCode: 'TWICE' })).status).toBe(200);
    const again = await calculate(app, alice, 'twice-1', { couponCode: 'OTHER' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('COUPON_ALREADY_APPLIED');
    expect(await remaining('TWICE')).toBe(9);
    expect(await remaining('OTHER')).toBe(10);
  });

  it('a coupon bound to another user is 404 COUPON_NOT_FOUND', async () => {
    await createCoupon('ALICEONLY', { userId: alice.id });
    const res = await calculate(app, bob, 'bound-1', { couponCode: 'ALICEONLY' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COUPON_NOT_FOUND');
    expect((await calculate(app, alice, 'bound-2', { couponCode: 'ALICEONLY' })).status).toBe(200);
  });
});

describe('POST /coupons/apply', () => {
  it('uses the audit total and cartId, returns 201 with the reservation', async () => {
    await createCoupon('APPLY10');
    const audit = await calculate(app, alice, 'apply-1');
    const res = await apply(app, alice, 'apply10', audit.body.data.auditId);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'RESERVED',
      code: 'APPLY10',
      cartId: 'apply-1',
      auditId: audit.body.data.auditId,
      subtotal: audit.body.data.total,
      remainingUses: 9,
    });
    expect(res.body.data.newTotal).toBe(res.body.data.subtotal - res.body.data.discountAmount);
    expect(res.body.data.expiresAt).toBeDefined();
  });

  it('rejects a client-supplied subtotal or cartId with 400', async () => {
    const auditId = await newAudit(app, alice, 'apply-strict');
    const res = await request(app)
      .post('/api/v1/coupons/apply')
      .set(...bearer(alice.token))
      .send({ code: 'APPLY10', auditId, subtotal: 1 });
    expect(res.status).toBe(400);
  });

  it('404 AUDIT_NOT_FOUND for a missing audit or one owned by someone else', async () => {
    const aliceAudit = await newAudit(app, alice, 'apply-owner');
    const stolen = await apply(app, bob, 'APPLY10', aliceAudit);
    expect(stolen.status).toBe(404);
    expect(stolen.body.error.code).toBe('AUDIT_NOT_FOUND');
    const missing = await apply(app, bob, 'APPLY10', '00000000-0000-4000-8000-000000000000');
    expect(missing.body.error.code).toBe('AUDIT_NOT_FOUND');
  });

  it('MIN_SUBTOTAL_NOT_MET, COUPON_ALREADY_APPLIED and per-user cap', async () => {
    await createCoupon('APMIN', { minSubtotal: 1_000_000 });
    const a1 = await newAudit(app, alice, 'ap-min');
    const min = await apply(app, alice, 'APMIN', a1);
    expect(min.status).toBe(422);
    expect(min.body.error.code).toBe('MIN_SUBTOTAL_NOT_MET');

    await createCoupon('APCAP', { maxUses: 10, perUserLimit: 1 });
    const a2 = await newAudit(app, alice, 'ap-cap-1');
    expect((await apply(app, alice, 'APCAP', a2)).status).toBe(201);
    const dup = await apply(app, alice, 'APCAP', a2);
    expect(dup.body.error.code).toBe('COUPON_ALREADY_APPLIED');
    const capped = await apply(app, alice, 'APCAP', await newAudit(app, alice, 'ap-cap-2'));
    expect(capped.status).toBe(409);
    expect(capped.body.error.code).toBe('COUPON_LIMIT_REACHED');
    expect(await remaining('APCAP')).toBe(9);
  });

  it('409 COUPON_UNAVAILABLE for expired and inactive coupons', async () => {
    await createCoupon('OLD', { expiresAt: new Date(Date.now() - 1000) });
    await createCoupon('OFF', { isActive: false });
    const auditId = await newAudit(app, alice, 'unavail');
    for (const code of ['OLD', 'OFF']) {
      const res = await apply(app, alice, code, auditId);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('COUPON_UNAVAILABLE');
    }
  });

  it('404 COUPON_NOT_FOUND for an unknown code', async () => {
    const res = await apply(app, alice, 'NOPE', await newAudit(app, alice, 'unknown'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COUPON_NOT_FOUND');
  });
});
