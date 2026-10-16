import mongoose from 'mongoose';
import type { ClientSession } from 'mongoose';
import { Coupon } from '../models/coupon.model';
import { CouponReservation } from '../models/couponReservation.model';
import { AppError } from '../errors/AppError';
import type { ApplyCouponRequest, ApplyCouponResponse } from '../dtos/coupon.dto';
import { couponDiscount } from './coupon.discount';

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

async function reserveCoupon(
  req: ApplyCouponRequest,
  session: ClientSession,
  now: Date,
): Promise<ApplyCouponResponse> {
  const coupon = await Coupon.findOne({ code: req.code }).session(session);
  if (!coupon) throw new AppError(404, 'COUPON_NOT_FOUND', `Coupon ${req.code} not found`);
  if (!coupon.isActive || coupon.expiresAt <= now) {
    throw new AppError(409, 'COUPON_UNAVAILABLE', 'Coupon is inactive or expired');
  }
  if (req.subtotal < coupon.minSubtotal) {
    throw new AppError(422, 'MIN_SUBTOTAL_NOT_MET', 'Subtotal below coupon minimum', {
      minSubtotal: coupon.minSubtotal,
    });
  }
  const existing = await CouponReservation.findOne({
    couponCode: coupon.code,
    cartId: req.cartId,
  }).session(session);
  if (existing) throw new AppError(409, 'COUPON_ALREADY_APPLIED', 'Coupon already applied to cart');

  const updated = await Coupon.findOneAndUpdate(
    { _id: coupon._id, remainingUses: mongoose.trusted({ $gt: 0 }) },
    { $inc: { remainingUses: -1 } },
    { session, new: true },
  );
  if (!updated) throw new AppError(409, 'COUPON_EXHAUSTED', 'Coupon has no remaining uses');

  const discountAmount = couponDiscount(coupon.discountType, coupon.value, req.subtotal);
  let reservationId: string;
  try {
    const [created] = await CouponReservation.create(
      [
        {
          couponCode: coupon.code,
          cartId: req.cartId,
          discount: discountAmount,
          subtotal: req.subtotal,
        },
      ],
      { session },
    );
    reservationId = String(created?._id);
  } catch (err) {
    if (isDuplicateKey(err)) {
      throw new AppError(409, 'COUPON_ALREADY_APPLIED', 'Coupon already applied to cart');
    }
    throw err;
  }

  return {
    status: 'RESERVED',
    reservationId,
    code: coupon.code,
    cartId: req.cartId,
    subtotal: req.subtotal,
    discountAmount,
    newTotal: req.subtotal - discountAmount,
    remainingUses: updated.remainingUses,
  };
}

export async function applyCoupon(
  req: ApplyCouponRequest,
  now: Date = new Date(),
): Promise<ApplyCouponResponse> {
  const session = await mongoose.startSession();
  try {
    let response: ApplyCouponResponse | undefined;
    await session.withTransaction(async () => {
      response = await reserveCoupon(req, session, now);
    });
    if (!response) throw new AppError(500, 'INTERNAL_ERROR', 'Transaction produced no result');
    return response;
  } finally {
    await session.endSession();
  }
}
