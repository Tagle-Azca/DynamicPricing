import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError';
import { SHIPPING_CURRENCY, selectShipping, shippingOptionsFor } from '../config/shipping';
import type { CalculateRequest } from '../dtos/pricing.dto';
import { recordAudit } from './audit.service';
import { reserveCoupon } from './coupon.reserve';
import { releaseSameCodeReservation } from './coupon.requote';
import { priceCart } from './pricing.price';
import { buildQuote } from './pricing.response';
import type { CalculateResponse } from './pricing.response';

export type { CalculateResponse } from './pricing.response';

/** `request.context.userId` must already be resolved to the audit owner. */
export async function calculatePricing(
  request: CalculateRequest,
  ttlSeconds: number,
  now: Date = new Date(),
): Promise<CalculateResponse> {
  const { cartId, context, couponCode, delivery } = request;
  if (delivery && context.currency !== SHIPPING_CURRENCY) {
    throw new AppError(
      422,
      'SHIPPING_UNSUPPORTED_CURRENCY',
      `Shipping is only available in ${SHIPPING_CURRENCY}`,
    );
  }
  const { items, result, campaigns } = await priceCart(request.items, context, now);
  const parts = { cartId, items, result, context, campaigns };
  if (!couponCode) {
    const shippingOptions = shippingOptionsFor(result.total);
    const shipping = selectShipping(shippingOptions, delivery);
    const audit = await recordAudit({ cartId, context, items, result, shipping });
    return buildQuote({
      ...parts,
      auditId: audit.auditId,
      calculatedAt: audit.createdAt,
      shippingOptions,
      shipping,
    });
  }
  const userId = context.userId ?? '';
  const auditId = randomUUID();
  // Reservation and audit commit together; a failure in either leaves remainingUses untouched.
  return mongoose.connection.transaction(async (session) => {
    await releaseSameCodeReservation({ code: couponCode, userId, cartId, now }, session);
    const coupon = await reserveCoupon(
      {
        code: couponCode,
        userId,
        cartId,
        auditId,
        subtotal: result.total,
        currency: result.currency,
        now,
        ttlSeconds,
      },
      session,
    );
    const shippingOptions = shippingOptionsFor(result.total - coupon.discountAmount);
    const shipping = selectShipping(shippingOptions, delivery);
    const audit = await recordAudit(
      {
        cartId,
        context,
        items,
        result,
        auditId,
        shipping,
        coupon: {
          code: coupon.code,
          discountAmount: coupon.discountAmount,
          reservationId: coupon.reservationId,
          expiresAt: coupon.expiresAt.toISOString(),
        },
      },
      session,
    );
    return buildQuote({
      ...parts,
      auditId,
      calculatedAt: audit.createdAt,
      coupon,
      shippingOptions,
      shipping,
    });
  });
}
