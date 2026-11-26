import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { seedPricingData } from './helpers/fixtures';
import { calculate } from './helpers/pricing';
import { bigCart, setTier } from './helpers/orders';
import { createCoupon, remaining } from './helpers/coupons';
import { PricingAudit } from '../src/models/pricingAudit.model';
import { CouponReservation } from '../src/models/couponReservation.model';
import { isChecksumValid } from '../src/services/audit.query.service';
import { computeChecksum } from '../src/services/audit.checksum';
import type { AuditSnapshot } from '../src/dtos/audit.dto';

let app: Express;
let alice: TestUser;
let gold: TestUser;

beforeAll(async () => {
  await openDatabase('test_shipping');
  await seedPricingData();
  app = buildApp();
  alice = await createTestUser(app, 'customer', 'alice');
  gold = await createTestUser(app, 'customer', 'gold');
  await setTier(gold, 'gold');
});
afterAll(closeDatabase);

describe('server-side tier [DoD-2]', () => {
  it('ignores a client customerTier and stores the server tier in the audit', async () => {
    const res = await calculate(app, alice, 'tier-1', {
      ...bigCart,
      context: { customerTier: 'platinum', currency: 'USD' },
    });
    expect(res.status).toBe(200);
    expect(res.body.data.appliedRules.map((r: { code: string }) => r.code)).not.toContain('GOLD15');
    const audit = await PricingAudit.findOne({ auditId: res.body.data.auditId }).lean();
    expect(audit?.context.customerTier).toBe('standard');
  });

  it('applies tier campaigns from the stored tier even when the client claims standard', async () => {
    const res = await calculate(app, gold, 'tier-2', {
      ...bigCart,
      context: { customerTier: 'standard', currency: 'USD' },
    });
    expect(res.body.data.appliedRules.map((r: { code: string }) => r.code)).toContain('GOLD15');
    const audit = await PricingAudit.findOne({ auditId: res.body.data.auditId }).lean();
    expect(audit?.context.customerTier).toBe('gold');
  });

  it('exposes tier on login and /auth/me', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: gold.email, password: gold.password });
    expect(login.body.data.user.tier).toBe('gold');
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set(...bearer(gold.token));
    expect(me.body.data.tier).toBe('gold');
  });
});

describe('shipping and quote additions [DoD-3, DoD-4]', () => {
  it('returns lineTotal, savings, shippingOptions and no shipping without delivery', async () => {
    const res = await calculate(app, alice, 'ship-1', {
      items: [{ sku: 'SKU-KEYBOARD', quantity: 2 }],
    });
    const d = res.body.data;
    expect(d.items[0].lineTotal).toBe(5000);
    expect(d.savings).toBe(d.totalDiscount);
    expect(d.shippingOptions).toEqual([
      { method: 'standard', label: 'Standard', eta: '3-5 business days', amount: 499 },
      { method: 'express', label: 'Express', eta: '1-2 business days', amount: 1299 },
    ]);
    expect(d.shipping).toBeUndefined();
    expect(d.grandTotal).toBeUndefined();
  });

  it('adds shipping and grandTotal when delivery is sent', async () => {
    const res = await calculate(app, alice, 'ship-2', {
      items: [{ sku: 'SKU-KEYBOARD', quantity: 2 }],
      delivery: 'express',
    });
    const d = res.body.data;
    expect(d.shipping.amount).toBe(1299);
    expect(d.grandTotal).toBe(d.finalTotal + 1299);
  });

  it('standard shipping is free from 10000 and express never is', async () => {
    const res = await calculate(app, alice, 'ship-3', { ...bigCart, delivery: 'standard' });
    const d = res.body.data;
    expect(d.finalTotal).toBeGreaterThanOrEqual(10000);
    expect(d.shipping.amount).toBe(0);
    expect(d.grandTotal).toBe(d.finalTotal);
    expect(d.shippingOptions[1].amount).toBe(1299);
  });

  it('the free threshold uses the total after the coupon', async () => {
    await createCoupon('DROPBELOW', { discountType: 'fixed', value: 5000 });
    const res = await calculate(app, alice, 'ship-4', {
      ...bigCart,
      couponCode: 'DROPBELOW',
      delivery: 'standard',
    });
    const d = res.body.data;
    expect(d.finalTotal).toBeLessThan(10000);
    expect(d.shipping.amount).toBe(499);
    expect(d.savings).toBe(d.totalDiscount + 5000);
  });

  it('rejects delivery on a non-USD cart', async () => {
    const res = await calculate(app, alice, 'ship-5', {
      context: { currency: 'EUR' },
      delivery: 'standard',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SHIPPING_UNSUPPORTED_CURRENCY');
  });

  it('rejects an unknown delivery method', async () => {
    const res = await calculate(app, alice, 'ship-6', { delivery: 'drone' });
    expect(res.status).toBe(400);
  });

  it('checksums shipping only when present and old audits still verify', async () => {
    const withShip = await calculate(app, alice, 'sum-1', { delivery: 'standard' });
    const without = await calculate(app, alice, 'sum-2');
    const load = async (id: string): Promise<AuditSnapshot> =>
      (await PricingAudit.findOne({ auditId: id }).select('-_id').lean()) as AuditSnapshot;
    const a = await load(withShip.body.data.auditId);
    const b = await load(without.body.data.auditId);
    expect(a.shipping?.method).toBe('standard');
    expect(isChecksumValid(a)).toBe(true);
    expect(isChecksumValid({ ...a, shipping: { ...a.shipping!, amount: 0 } })).toBe(false);
    expect(b.shipping).toBeUndefined();
    expect(isChecksumValid(b)).toBe(true);
    const { auditId, cartId, context, items, result } = b;
    expect(computeChecksum({ auditId, cartId, context, items, result })).toBe(b.checksum);
  });
});

describe('nextThreshold [DoD-4]', () => {
  it('points at the closest unmet minSubtotal campaign', async () => {
    const res = await calculate(app, alice, 'next-1', {
      items: [{ sku: 'SKU-KEYBOARD', quantity: 2 }],
    });
    expect(res.body.data.nextThreshold).toEqual({
      code: 'MEGA25',
      name: 'Mega 25% off big carts',
      minSubtotal: 50000,
      remaining: 45000,
      progressPercent: 10,
    });
  });

  it('is absent once the campaign is applied', async () => {
    const res = await calculate(app, alice, 'next-2', {
      items: [{ sku: 'SKU-LAPTOP', quantity: 1 }],
    });
    expect(res.body.data.appliedRules.map((r: { code: string }) => r.code)).toContain('MEGA25');
    expect(res.body.data.nextThreshold).toBeUndefined();
  });
});

describe('coupon re-quote on the same cart [DoD-4]', () => {
  it('releases and reserves again without consuming an extra use', async () => {
    await createCoupon('REQUOTE', { perUserLimit: 1, maxUses: 5 });
    const first = await calculate(app, alice, 'rq-1', { couponCode: 'REQUOTE' });
    const second = await calculate(app, alice, 'rq-1', {
      couponCode: 'REQUOTE',
      delivery: 'express',
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.coupon.reservationId).not.toBe(first.body.data.coupon.reservationId);
    expect(await remaining('REQUOTE')).toBe(4);
    const rows = await CouponReservation.find({ couponCode: 'REQUOTE', userId: alice.id }).lean();
    expect(rows.filter((r) => r.status === 'RESERVED')).toHaveLength(1);
    expect(rows.filter((r) => r.status === 'RELEASED')).toHaveLength(1);
  });

  it('serializes concurrent re-quotes into one active reservation', async () => {
    await createCoupon('RACE', { perUserLimit: 1, maxUses: 5 });
    await calculate(app, alice, 'rq-2', { couponCode: 'RACE' });
    const results = await Promise.all(
      [1, 2, 3].map(() => calculate(app, alice, 'rq-2', { couponCode: 'RACE' })),
    );
    expect(results.every((r) => [200, 409].includes(r.status))).toBe(true);
    expect(results.some((r) => r.status === 200)).toBe(true);
    const active = await CouponReservation.countDocuments({
      couponCode: 'RACE',
      status: 'RESERVED',
    });
    expect(active).toBe(1);
    expect(await remaining('RACE')).toBe(4);
  });
});
