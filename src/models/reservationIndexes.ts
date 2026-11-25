import mongoose from 'mongoose';
import { CouponReservation } from './couponReservation.model';
import { releaseOne } from '../services/coupon.release';

const LEGACY_INDEX = 'couponCode_1_cartId_1';
const UNIQUE_KEYS = [['couponCode', 'cartId'], ['cartId', 'userId'], ['auditId']] as const;

function errorCode(err: unknown): unknown {
  return typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
}

/** Replaces `couponCode_1_cartId_1` when it is not the partial unique index the model declares. */
export async function replaceStaleReservationIndex(): Promise<boolean> {
  let indexes: Array<Record<string, unknown>>;
  try {
    indexes = await CouponReservation.collection.indexes();
  } catch (err) {
    if (errorCode(err) === 26) return false; // collection does not exist yet
    throw err;
  }
  const existing = indexes.find((i) => i.name === LEGACY_INDEX);
  if (!existing) return false;
  const partial = existing.partialFilterExpression as Record<string, unknown> | undefined;
  const correct =
    existing.unique === true && partial?.status === 'RESERVED' && Object.keys(partial).length === 1;
  if (correct) return false;
  await CouponReservation.collection.dropIndex(LEGACY_INDEX);
  console.log(`Dropped stale index ${LEGACY_INDEX}; it is rebuilt with the RESERVED filter`);
  return true;
}

/** Releases every RESERVED row but the newest in each group that would break a unique index. */
export async function releaseDuplicateReservations(now: Date = new Date()): Promise<number> {
  let released = 0;
  for (const keys of UNIQUE_KEYS) {
    const groups = await CouponReservation.aggregate<{ ids: unknown[] }>([
      { $match: { status: 'RESERVED' } },
      { $sort: { createdAt: 1, _id: 1 } },
      {
        $group: {
          _id: Object.fromEntries(keys.map((k) => [k, `$${k}`])),
          ids: { $push: '$_id' },
        },
      },
      { $match: { 'ids.1': { $exists: true } } },
    ]);
    for (const { ids } of groups) {
      for (const _id of ids.slice(0, -1)) {
        const done = await mongoose.connection.transaction((s) => releaseOne({ _id }, s, now));
        if (done) released += 1;
      }
    }
  }
  return released;
}

/** Builds the reservation indexes, repairing a legacy index and duplicate active rows first. */
export async function prepareReservationIndexes(): Promise<void> {
  await replaceStaleReservationIndex();
  try {
    await CouponReservation.syncIndexes();
  } catch (err) {
    if (errorCode(err) !== 11000) throw err;
    const released = await releaseDuplicateReservations();
    console.log(
      `Duplicate RESERVED coupon reservations blocked the index build; released ${released} older ones`,
    );
    await CouponReservation.syncIndexes();
  }
}
