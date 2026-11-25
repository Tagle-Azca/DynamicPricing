import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Campaign } from '../models/campaign.model';
import { AppError } from '../errors/AppError';
import type { CalculateRequest, CartItem, PricingResult } from '../dtos/pricing.dto';
import type { ReserveResult } from '../dtos/coupon.dto';
import { evaluateCampaigns } from './pricing.rules';
import { recordAudit } from './audit.service';
import { resolveItems } from './catalog.service';
import { reserveCoupon } from './coupon.reserve';

export interface CalculateResponse extends PricingResult {
  auditId: string;
  cartId: string;
  items: CartItem[];
  calculatedAt: Date;
  finalTotal: number;
  coupon?: ReserveResult;
}

async function priceCart(
  request: CalculateRequest,
  now: Date,
): Promise<{ items: CartItem[]; result: PricingResult }> {
  const items = await resolveItems(request.items, request.context.currency);
  const campaigns = await Campaign.find({
    isActive: true,
    startsAt: mongoose.trusted({ $lte: now }),
    endsAt: mongoose.trusted({ $gt: now }),
  }).lean();
  const result = evaluateCampaigns(campaigns, items, request.context);
  if (!Number.isSafeInteger(result.subtotal)) {
    throw new AppError(422, 'AMOUNT_TOO_LARGE', 'Cart subtotal exceeds the supported amount');
  }
  return { items, result };
}

/** `request.context.userId` must already be resolved to the audit owner. */
export async function calculatePricing(
  request: CalculateRequest,
  ttlSeconds: number,
  now: Date = new Date(),
): Promise<CalculateResponse> {
  const { items, result } = await priceCart(request, now);
  const { cartId, context, couponCode } = request;
  const base = { cartId, context, items, result };
  if (!couponCode) {
    const { auditId, createdAt } = await recordAudit(base);
    return { auditId, cartId, items, ...result, calculatedAt: createdAt, finalTotal: result.total };
  }
  const userId = context.userId ?? '';
  const auditId = randomUUID();
  // Reservation and audit commit together; a failure in either leaves remainingUses untouched.
  const { coupon, createdAt } = await mongoose.connection.transaction(async (session) => {
    const reserved = await reserveCoupon(
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
    const audit = await recordAudit(
      {
        ...base,
        auditId,
        coupon: {
          code: reserved.code,
          discountAmount: reserved.discountAmount,
          reservationId: reserved.reservationId,
          expiresAt: reserved.expiresAt.toISOString(),
        },
      },
      session,
    );
    return { coupon: reserved, createdAt: audit.createdAt };
  });
  return {
    auditId,
    cartId,
    items,
    ...result,
    calculatedAt: createdAt,
    finalTotal: result.total - coupon.discountAmount,
    coupon,
  };
}
