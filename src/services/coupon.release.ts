import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import { Coupon } from '../models/coupon.model';
import { CouponReservation } from '../models/couponReservation.model';
import { AppError } from '../errors/AppError';
import type { ReleaseResponse } from '../dtos/coupon.dto';

interface Released {
  couponCode: string;
  remainingUses: number;
}

async function restoreUse(code: string, session: ClientSession): Promise<number> {
  const coupon = await Coupon.findOne({ code }).session(session);
  if (!coupon) return 0;
  // Capped at maxUses so a double release can never inflate the counter.
  const restored = await Coupon.findOneAndUpdate(
    { _id: coupon._id, remainingUses: mongoose.trusted({ $lt: coupon.maxUses }) },
    { $inc: { remainingUses: 1 } },
    { session, new: true },
  );
  return (restored ?? coupon).remainingUses;
}

/** Flips one RESERVED reservation to RELEASED (exactly once) and returns its use to the coupon. */
export async function releaseOne(
  filter: Record<string, unknown>,
  session: ClientSession,
  now: Date,
): Promise<Released | null> {
  const flipped = await CouponReservation.findOneAndUpdate(
    { ...filter, status: 'RESERVED' },
    { $set: { status: 'RELEASED', releasedAt: now } },
    { session },
  );
  if (!flipped) return null;
  return {
    couponCode: flipped.couponCode,
    remainingUses: await restoreUse(flipped.couponCode, session),
  };
}

export async function releaseReservation(
  reservationId: string,
  userId: string,
  now: Date = new Date(),
): Promise<ReleaseResponse> {
  return mongoose.connection.transaction(async (session) => {
    const released = await releaseOne({ _id: reservationId, userId }, session, now);
    if (released) {
      return { status: 'RELEASED' as const, reservationId, remainingUses: released.remainingUses };
    }
    const existing = await CouponReservation.exists({ _id: reservationId, userId }).session(
      session,
    );
    if (existing) {
      throw new AppError(409, 'RESERVATION_NOT_ACTIVE', 'Reservation is already released');
    }
    throw new AppError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
  });
}

const SWEEP_BATCH = 100;

/** Releases every RESERVED reservation whose expiresAt has passed. Safe to run repeatedly. */
export async function releaseExpiredReservations(now: Date = new Date()): Promise<number> {
  let released = 0;
  for (;;) {
    const batch = await CouponReservation.find({
      status: 'RESERVED',
      expiresAt: mongoose.trusted({ $lte: now }),
    })
      .select('_id')
      .limit(SWEEP_BATCH)
      .lean();
    let progressed = 0;
    for (const { _id } of batch) {
      const done = await mongoose.connection.transaction((session) =>
        releaseOne({ _id }, session, now),
      );
      if (done) progressed += 1;
    }
    released += progressed;
    if (progressed === 0) return released;
  }
}
