import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import { Coupon } from '../models/coupon.model';
import { CouponReservation } from '../models/couponReservation.model';
import { AppError } from '../errors/AppError';
import type { ReserveResult } from '../dtos/coupon.dto';
import { couponDiscount } from './coupon.discount';
import { releaseOne } from './coupon.release';

export interface ReserveInput {
  code: string;
  userId: string;
  cartId: string;
  auditId: string;
  subtotal: number;
  currency: string;
  now: Date;
  ttlSeconds: number;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

const alreadyApplied = (): AppError =>
  new AppError(409, 'COUPON_ALREADY_APPLIED', 'Coupon already applied to cart');

/**
 * Must run inside a transaction. The decrement of the coupon document comes before the
 * per-user count: concurrent transactions conflict on that document and are serialized,
 * so the count each one sees already includes every earlier committed reservation.
 */
export async function reserveCoupon(
  input: ReserveInput,
  session: ClientSession,
): Promise<ReserveResult> {
  const { code, userId, cartId, auditId, subtotal, currency, now, ttlSeconds } = input;
  const coupon = await Coupon.findOne({ code: { $eq: code } }).session(session);
  if (!coupon || (coupon.userId && coupon.userId !== userId)) {
    throw new AppError(404, 'COUPON_NOT_FOUND', `Coupon ${code} not found`);
  }
  if (!coupon.isActive || coupon.expiresAt <= now) {
    throw new AppError(409, 'COUPON_UNAVAILABLE', 'Coupon is inactive or expired');
  }
  if ((coupon.currency ?? 'USD') !== currency) {
    throw new AppError(422, 'CURRENCY_MISMATCH', 'Coupon currency differs from cart currency', {
      couponCurrency: coupon.currency ?? 'USD',
      cartCurrency: currency,
    });
  }
  if (subtotal < coupon.minSubtotal) {
    throw new AppError(422, 'MIN_SUBTOTAL_NOT_MET', 'Subtotal below coupon minimum', {
      minSubtotal: coupon.minSubtotal,
    });
  }
  const expiredFilter = { cartId, userId, expiresAt: mongoose.trusted({ $lte: now }) };
  while (await releaseOne(expiredFilter, session, now)) continue;
  const holder = await CouponReservation.exists({
    status: 'RESERVED',
    $or: [{ cartId, userId }, { auditId }],
  }).session(session);
  if (holder) {
    throw alreadyApplied();
  }

  const updated = await Coupon.findOneAndUpdate(
    { _id: coupon._id, remainingUses: mongoose.trusted({ $gt: 0 }) },
    { $inc: { remainingUses: -1 } },
    { session, new: true },
  );
  if (!updated) throw new AppError(409, 'COUPON_EXHAUSTED', 'Coupon has no remaining uses');

  // Consumed reservations are completed orders and keep counting toward the per-user limit.
  const active = await CouponReservation.countDocuments({
    couponCode: { $eq: code },
    userId,
    $or: [
      { status: 'RESERVED', expiresAt: mongoose.trusted({ $gt: now }) },
      { status: 'CONSUMED' },
    ],
  }).session(session);
  if (active >= coupon.perUserLimit) {
    throw new AppError(409, 'COUPON_LIMIT_REACHED', 'Per-user coupon limit reached', {
      perUserLimit: coupon.perUserLimit,
    });
  }

  const discountAmount = couponDiscount(coupon.discountType, coupon.value, subtotal);
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  try {
    const [created] = await CouponReservation.create(
      [
        {
          couponCode: code,
          userId,
          cartId,
          auditId,
          discount: discountAmount,
          subtotal,
          expiresAt,
        },
      ],
      { session },
    );
    return {
      reservationId: String(created?._id),
      code,
      discountAmount,
      remainingUses: updated.remainingUses,
      expiresAt,
    };
  } catch (err) {
    throw isDuplicateKey(err) ? alreadyApplied() : err;
  }
}
