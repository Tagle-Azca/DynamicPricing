import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { seedPricingData } from './helpers/fixtures';
import { apply, calculate } from './helpers/pricing';
import { bigCart, orderBody, postOrder, setTier } from './helpers/orders';
import { createCoupon } from './helpers/coupons';
import { CouponReservation } from '../src/models/couponReservation.model';
import { PricingAudit } from '../src/models/pricingAudit.model';

let app: Express;
let alice: TestUser;
let admin: TestUser;

beforeAll(async () => {
  await openDatabase('test_orders_guards');
  await seedPricingData();
  app = buildApp();
  alice = await createTestUser(app, 'customer', 'alice');
  admin = await createTestUser(app, 'admin', 'root');
  await setTier(admin, 'platinum');
});
afterAll(closeDatabase);

describe('audit owner tier [DoD-2]', () => {
  it('prices an admin quote for a standard customer with the customer tier', async () => {
    const res = await calculate(app, admin, 'tier-1', {
      ...bigCart,
      delivery: 'standard',
      context: { currency: 'USD', userId: alice.id },
    });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.data.appliedRules)).not.toContain('GOLD15');
    const audit = await PricingAudit.findOne({ auditId: res.body.data.auditId }).lean();
    expect(audit?.context.customerTier).toBe('standard');
    expect(audit?.context.userId).toBe(alice.id);
    const order = await postOrder(app, alice, orderBody(String(res.body.data.auditId)));
    expect(order.status).toBe(201);
  });
});

describe('POST /orders with a reservation the quote does not record [DoD-6]', () => {
  it('409 COUPON_RESERVATION_INVALID after a legacy /coupons/apply on the audit', async () => {
    await createCoupon('LATE10', { maxUses: 5 });
    const quoted = await calculate(app, alice, 'late-1', { ...bigCart, delivery: 'standard' });
    const auditId = String(quoted.body.data.auditId);
    const applied = await apply(app, alice, 'LATE10', auditId);
    expect(applied.status).toBe(201);
    expect(applied.body.data.newTotal).toBeLessThan(quoted.body.data.total);
    const order = await postOrder(app, alice, orderBody(auditId));
    expect(order.status).toBe(409);
    expect(order.body.error.code).toBe('COUPON_RESERVATION_INVALID');
    const reservation = await CouponReservation.findOne({ auditId }).lean();
    expect(reservation?.status).toBe('RESERVED');
  });
});
