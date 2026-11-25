import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { seedPricingData } from './helpers/fixtures';
import { apply, calculate, newAudit } from './helpers/pricing';
import { createCoupon, remaining } from './helpers/coupons';
import { Coupon } from '../src/models/coupon.model';
import { CouponReservation } from '../src/models/couponReservation.model';
import { releaseExpiredReservations } from '../src/services/coupon.release';
import { startReservationSweeper } from '../src/services/reservation.sweeper';

let app: Express;
let alice: TestUser;
let bob: TestUser;

const release = (user: TestUser, id: string): request.Test =>
  request(app)
    .delete(`/api/v1/coupons/reservations/${id}`)
    .set(...bearer(user.token));

async function reserve(code: string, user: TestUser, cartId: string): Promise<string> {
  const res = await apply(app, user, code, await newAudit(app, user, cartId));
  return String(res.body.data.reservationId);
}

beforeAll(async () => {
  await openDatabase('test_reservations');
  await seedPricingData();
  app = buildApp({ reservationTtlSeconds: 120 });
  alice = await createTestUser(app, 'customer', 'alice');
  bob = await createTestUser(app, 'customer', 'bob');
});
afterAll(closeDatabase);

describe('DELETE /coupons/reservations/:id', () => {
  it('restores exactly one use, once; a second release is 409', async () => {
    await createCoupon('REL', { maxUses: 3 });
    const id = await reserve('REL', alice, 'rel-1');
    expect(await remaining('REL')).toBe(2);
    const first = await release(alice, id);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ status: 'RELEASED', reservationId: id, remainingUses: 3 });
    const second = await release(alice, id);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('RESERVATION_NOT_ACTIVE');
    expect(await remaining('REL')).toBe(3);
  });

  it("another user's or an unknown reservation is 404 RESERVATION_NOT_FOUND", async () => {
    await createCoupon('RELOWN', { maxUses: 3 });
    const id = await reserve('RELOWN', alice, 'own-1');
    const stolen = await release(bob, id);
    expect(stolen.status).toBe(404);
    expect(stolen.body.error.code).toBe('RESERVATION_NOT_FOUND');
    expect((await release(alice, '0'.repeat(24))).status).toBe(404);
    expect((await release(alice, 'not-an-id')).status).toBe(400);
    expect(await remaining('RELOWN')).toBe(2);
  });

  it('frees the cart and the per-user slot so the coupon can be reserved again', async () => {
    await createCoupon('AGAIN', { maxUses: 3 });
    const id = await reserve('AGAIN', alice, 'again-1');
    await release(alice, id);
    const res = await calculate(app, alice, 'again-1', { couponCode: 'AGAIN' });
    expect(res.status).toBe(200);
    expect(await remaining('AGAIN')).toBe(2);
  });

  it('concurrent releases restore the use only once', async () => {
    await createCoupon('RACE', { maxUses: 3 });
    const id = await reserve('RACE', alice, 'race-1');
    const results = await Promise.all([release(alice, id), release(alice, id), release(alice, id)]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await remaining('RACE')).toBe(3);
  });
});

describe('expiry', () => {
  it('stores expiresAt from RESERVATION_TTL_SECONDS', async () => {
    await createCoupon('TTL');
    const before = Date.now();
    const res = await calculate(app, alice, 'ttl-1', { couponCode: 'TTL' });
    const expires = new Date(res.body.data.coupon.expiresAt).getTime();
    expect(expires).toBeGreaterThanOrEqual(before + 120_000 - 50);
    expect(expires).toBeLessThanOrEqual(Date.now() + 120_000);
  });

  it('releaseExpiredReservations releases only expired ones, idempotently, within maxUses', async () => {
    await createCoupon('SWEEP', { maxUses: 4, perUserLimit: 5 });
    const expired = await reserve('SWEEP', alice, 'sw-1');
    await reserve('SWEEP', alice, 'sw-2');
    await CouponReservation.updateOne({ _id: expired }, { expiresAt: new Date(Date.now() - 1) });
    expect(await remaining('SWEEP')).toBe(2);

    expect(await releaseExpiredReservations()).toBe(1);
    expect(await remaining('SWEEP')).toBe(3);
    expect(await releaseExpiredReservations()).toBe(0);
    expect(await remaining('SWEEP')).toBe(3);
    const late = await release(alice, expired);
    expect(late.body.error.code).toBe('RESERVATION_NOT_ACTIVE');

    await Coupon.updateOne({ code: 'SWEEP' }, { remainingUses: 4 });
    await CouponReservation.updateOne(
      { couponCode: 'SWEEP', status: 'RESERVED' },
      { expiresAt: new Date(Date.now() - 1) },
    );
    expect(await releaseExpiredReservations()).toBe(1);
    expect(await remaining('SWEEP')).toBe(4);
  });

  it('an expired, unswept reservation does not block the same cart or the per-user cap', async () => {
    await createCoupon('LAZY', { maxUses: 3, perUserLimit: 1 });
    const id = await reserve('LAZY', alice, 'lazy-1');
    await CouponReservation.updateOne({ _id: id }, { expiresAt: new Date(Date.now() - 1) });
    const same = await calculate(app, alice, 'lazy-1', { couponCode: 'LAZY' });
    expect(same.status).toBe(200);
    expect(await remaining('LAZY')).toBe(2);
    expect(await CouponReservation.countDocuments({ couponCode: 'LAZY' })).toBe(2);
  });

  it('the sweeper timer is unref()-ed and can be stopped', () => {
    const timer = startReservationSweeper(60_000);
    expect(timer.hasRef()).toBe(false);
    clearInterval(timer);
  });
});
