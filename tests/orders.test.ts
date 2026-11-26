import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { seedPricingData } from './helpers/fixtures';
import { calculate } from './helpers/pricing';
import { ADDRESS, CONTACT, bigCart, orderBody, postOrder } from './helpers/orders';
import { createCoupon, remaining } from './helpers/coupons';
import { Order } from '../src/models/order.model';
import { Product } from '../src/models/product.model';
import { PricingAudit } from '../src/models/pricingAudit.model';
import { CouponReservation } from '../src/models/couponReservation.model';
import { releaseExpiredReservations } from '../src/services/coupon.release';

let app: Express;
let alice: TestUser;
let bob: TestUser;
let cartSeq = 0;

async function quote(user: TestUser, extra: Record<string, unknown> = {}): Promise<string> {
  cartSeq += 1;
  const res = await calculate(app, user, `ord-${cartSeq}`, {
    ...bigCart,
    delivery: 'standard',
    ...extra,
  });
  expect(res.status).toBe(200);
  return String(res.body.data.auditId);
}

beforeAll(async () => {
  await openDatabase('test_orders');
  await seedPricingData();
  app = buildApp();
  alice = await createTestUser(app, 'customer', 'alice');
  bob = await createTestUser(app, 'customer', 'bob');
});
afterAll(closeDatabase);

describe('POST /orders [DoD-6]', () => {
  it('401 without a token', async () => {
    expect((await request(app).post('/api/v1/orders').send({})).status).toBe(401);
  });

  it('creates an order from server re-pricing', async () => {
    const auditId = await quote(alice);
    const res = await postOrder(app, alice, orderBody(auditId));
    expect(res.status).toBe(201);
    const o = res.body.data;
    expect(o.orderNumber).toMatch(/^DP-[A-HJ-NP-Z2-9]{8}$/);
    expect(o).toMatchObject({
      status: 'CONFIRMED',
      payment: 'DEMO_NOT_CHARGED',
      currency: 'USD',
      contact: CONTACT,
      address: ADDRESS,
    });
    expect(o.shipping.amount).toBe(0);
    expect(o.grandTotal).toBe(o.subtotal - o.totalDiscount);
    expect(o.savings).toBe(o.totalDiscount);
    expect(o.items[0].lineTotal).toBe(o.items[0].unitPrice * o.items[0].quantity);
    expect(o.coupon).toBeUndefined();
  });

  it('replays the same order without a second consumption and hides it from others', async () => {
    await createCoupon('ORD10', { maxUses: 5 });
    const auditId = await quote(alice, { couponCode: 'ORD10' });
    const first = await postOrder(app, alice, orderBody(auditId));
    expect(first.status).toBe(201);
    expect(first.body.data.coupon).toEqual({
      code: 'ORD10',
      discountAmount: first.body.data.couponDiscount,
    });
    expect(await remaining('ORD10')).toBe(4);
    const again = await postOrder(app, alice, orderBody(auditId));
    expect(again.status).toBe(200);
    expect(again.body.data).toEqual(first.body.data);
    expect(await remaining('ORD10')).toBe(4);
    expect(await Order.countDocuments({ auditId })).toBe(1);
    const reservation = await CouponReservation.findOne({ couponCode: 'ORD10' }).lean();
    expect(reservation?.status).toBe('CONSUMED');
    expect((await postOrder(app, bob, orderBody(auditId))).status).toBe(404);
  });

  it('a consumed reservation survives the sweeper and still counts for the user', async () => {
    await createCoupon('ONCE', { perUserLimit: 1 });
    const auditId = await quote(alice, { couponCode: 'ONCE' });
    expect((await postOrder(app, alice, orderBody(auditId))).status).toBe(201);
    await CouponReservation.updateOne(
      { couponCode: 'ONCE' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    await releaseExpiredReservations();
    expect((await CouponReservation.findOne({ couponCode: 'ONCE' }).lean())?.status).toBe(
      'CONSUMED',
    );
    expect(await remaining('ONCE')).toBe(9);
    const next = await calculate(app, alice, 'ord-new-cart', { ...bigCart, couponCode: 'ONCE' });
    expect(next.status).toBe(409);
    expect(next.body.error.code).toBe('COUPON_LIMIT_REACHED');
  });

  it('concurrent posts for one audit create one order and consume once', async () => {
    await createCoupon('PARALLEL', { maxUses: 5 });
    const auditId = await quote(alice, { couponCode: 'PARALLEL' });
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => postOrder(app, alice, orderBody(auditId))),
    );
    expect(results.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    expect(new Set(results.map((r) => r.body.data.orderNumber)).size).toBe(1);
    expect(await Order.countDocuments({ auditId })).toBe(1);
    expect(await remaining('PARALLEL')).toBe(4);
  });

  it('409 AUDIT_STALE for an old quote', async () => {
    const auditId = await quote(alice);
    await PricingAudit.collection.updateOne(
      { auditId },
      { $set: { createdAt: new Date(Date.now() - 3_600_000) } },
    );
    const res = await postOrder(app, alice, orderBody(auditId));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AUDIT_STALE');
  });

  it('422 DELIVERY_REQUIRED when the audit has no shipping', async () => {
    const auditId = await quote(alice, { delivery: undefined });
    const res = await postOrder(app, alice, orderBody(auditId));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DELIVERY_REQUIRED');
  });

  it('422 REGION_MISMATCH against the quoted region, accepted when the quote has none', async () => {
    const withRegion = await quote(alice, { context: { currency: 'USD', region: 'AR' } });
    const bad = await postOrder(
      app,
      alice,
      orderBody(withRegion, { address: { ...ADDRESS, region: 'br' } }),
    );
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('REGION_MISMATCH');
    const none = await quote(alice);
    const ok = await postOrder(
      app,
      alice,
      orderBody(none, { address: { ...ADDRESS, region: 'br' } }),
    );
    expect(ok.status).toBe(201);
    expect(ok.body.data.address.region).toBe('BR');
  });

  it('409 PRICE_CHANGED when the catalog moved after the quote, nothing is consumed', async () => {
    await createCoupon('MOVED', { maxUses: 5 });
    const auditId = await quote(alice, { couponCode: 'MOVED' });
    await Product.updateOne({ sku: 'SKU-HEADPHONES' }, { $set: { unitPrice: 16000 } });
    const res = await postOrder(app, alice, orderBody(auditId));
    await Product.updateOne({ sku: 'SKU-HEADPHONES' }, { $set: { unitPrice: 15000 } });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRICE_CHANGED');
    expect(await Order.countDocuments({ auditId })).toBe(0);
    expect((await CouponReservation.findOne({ couponCode: 'MOVED' }).lean())?.status).toBe(
      'RESERVED',
    );
  });

  it('409 COUPON_RESERVATION_INVALID when the reservation was released', async () => {
    await createCoupon('GONE', { maxUses: 5 });
    const quoted = await calculate(app, alice, 'ord-gone', {
      ...bigCart,
      delivery: 'standard',
      couponCode: 'GONE',
    });
    await request(app)
      .delete(`/api/v1/coupons/reservations/${quoted.body.data.coupon.reservationId}`)
      .set(...bearer(alice.token));
    const res = await postOrder(app, alice, orderBody(quoted.body.data.auditId));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COUPON_RESERVATION_INVALID');
    expect(await Order.countDocuments({ auditId: quoted.body.data.auditId })).toBe(0);
  });

  it('rejects card fields and client amounts with 400, storing and echoing nothing', async () => {
    const auditId = await quote(alice);
    const secret = '4242424242424242';
    for (const extra of [
      { card: { number: secret, cvv: '123' } },
      { cardNumber: secret },
      { grandTotal: 1 },
      { contact: { ...CONTACT, cardNumber: secret } },
      { address: { ...ADDRESS, cvv: '123' } },
    ]) {
      const res = await postOrder(app, alice, orderBody(auditId, extra));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body)).not.toContain(secret);
    }
    expect(await Order.countDocuments({ auditId })).toBe(0);
  });

  it.each([
    ['email', { contact: { ...CONTACT, email: 'nope' } }],
    ['fullName', { contact: { ...CONTACT, fullName: 'A' } }],
    ['street', { address: { ...ADDRESS, street: 'ab' } }],
    ['city', { address: { ...ADDRESS, city: 'B' } }],
    ['postalCode', { address: { ...ADDRESS, postalCode: '12<3' } }],
    ['region', { address: { ...ADDRESS, region: 'ARG' } }],
    ['auditId', { auditId: 'not-a-uuid' }],
  ])('400 for an invalid %s', async (_name, extra) => {
    const res = await postOrder(app, alice, orderBody(await quote(alice), extra));
    expect(res.status).toBe(400);
  });

  it('orders are immutable snapshots', async () => {
    const auditId = await quote(alice);
    await postOrder(app, alice, orderBody(auditId));
    await expect(Order.updateOne({ auditId }, { $set: { grandTotal: 1 } })).rejects.toMatchObject({
      code: 'ORDER_IMMUTABLE',
    });
    await expect(Order.deleteOne({ auditId })).rejects.toMatchObject({ code: 'ORDER_IMMUTABLE' });
  });
});

describe('POST /orders rate limit [DoD-6]', () => {
  it('429 after the per-subject maximum', async () => {
    const limited = buildApp({ rateLimitCouponMax: 2 });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await postOrder(limited, bob, {})).status);
    }
    expect(statuses).toEqual([400, 400, 429]);
  });
});
