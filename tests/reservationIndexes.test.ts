import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDatabase, openDatabase } from './helpers/app';
import { createCoupon, remaining } from './helpers/coupons';
import { CouponReservation } from '../src/models/couponReservation.model';
import { initModels } from '../src/models';

const NAME = 'couponCode_1_cartId_1';

async function legacyIndex(): Promise<Record<string, unknown> | undefined> {
  return (await CouponReservation.collection.indexes()).find((i) => i.name === NAME);
}

function row(n: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    couponCode: 'MIG',
    userId: `u${n}`,
    cartId: 'same-cart',
    auditId: `audit-${n}`,
    discount: 1,
    subtotal: 10,
    status: 'RESERVED',
    expiresAt: new Date(Date.now() + 600_000),
    createdAt: new Date(Date.now() + n * 1000),
    ...extra,
  };
}

beforeAll(async () => {
  await openDatabase('test_reservation_indexes');
});
afterAll(closeDatabase);

describe('reservation index migration [DoD-7]', () => {
  it('creates the partial unique index on a fresh database', async () => {
    const idx = await legacyIndex();
    expect(idx?.unique).toBe(true);
    expect(idx?.partialFilterExpression).toEqual({ status: 'RESERVED' });
  });

  it('is idempotent when the index is already right', async () => {
    const before = await legacyIndex();
    await initModels();
    await initModels();
    expect(await legacyIndex()).toEqual(before);
  });

  it('replaces a legacy non-partial index and keeps the data', async () => {
    await CouponReservation.collection.dropIndex(NAME);
    await CouponReservation.collection.createIndex({ couponCode: 1, cartId: 1 }, { unique: true });
    await CouponReservation.collection.insertOne(row(1, { cartId: 'keep-me' }));
    await initModels();
    const idx = await legacyIndex();
    expect(idx?.partialFilterExpression).toEqual({ status: 'RESERVED' });
    expect(await CouponReservation.countDocuments({ cartId: 'keep-me' })).toBe(1);
    await CouponReservation.collection.deleteMany({});
  });

  it('releases older duplicate RESERVED rows instead of failing the index build', async () => {
    await createCoupon('MIG', { maxUses: 5, remainingUses: 2 });
    await CouponReservation.collection.dropIndex(NAME);
    await CouponReservation.collection.insertMany([row(1), row(2), row(3)]);
    await initModels();
    const rows = await CouponReservation.find({ couponCode: 'MIG' }).sort({ createdAt: 1 }).lean();
    expect(rows.map((r) => r.status)).toEqual(['RELEASED', 'RELEASED', 'RESERVED']);
    expect(await remaining('MIG')).toBe(4);
    expect((await legacyIndex())?.unique).toBe(true);
  });
});
