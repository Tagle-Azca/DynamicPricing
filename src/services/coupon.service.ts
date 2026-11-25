import mongoose from 'mongoose';
import { PricingAudit } from '../models/pricingAudit.model';
import { AppError } from '../errors/AppError';
import type { ApplyCouponRequest, ApplyCouponResponse } from '../dtos/coupon.dto';
import type { AuditSnapshot } from '../dtos/audit.dto';
import { reserveCoupon } from './coupon.reserve';

/** Reserves a coupon against a previously calculated audit owned by the caller. */
export async function applyCoupon(
  req: ApplyCouponRequest,
  userId: string,
  ttlSeconds: number,
  auditQuoteTtlSeconds: number,
  now: Date = new Date(),
): Promise<ApplyCouponResponse> {
  const audit = await PricingAudit.findOne({ auditId: req.auditId, 'context.userId': userId })
    .select('-_id')
    .lean<AuditSnapshot>();
  if (!audit) throw new AppError(404, 'AUDIT_NOT_FOUND', `Audit ${req.auditId} not found`);
  if (audit.coupon) {
    throw new AppError(409, 'COUPON_ALREADY_APPLIED', 'A coupon is already applied to this audit');
  }
  if (audit.createdAt.getTime() < now.getTime() - auditQuoteTtlSeconds * 1000) {
    throw new AppError(409, 'AUDIT_STALE', 'Audit is too old; recalculate the cart', {
      auditQuoteTtlSeconds,
    });
  }
  const subtotal = audit.result.total;
  const reserved = await mongoose.connection.transaction((session) =>
    reserveCoupon(
      {
        code: req.code,
        userId,
        cartId: audit.cartId,
        auditId: audit.auditId,
        subtotal,
        currency: audit.result.currency,
        now,
        ttlSeconds,
      },
      session,
    ),
  );
  return {
    status: 'RESERVED',
    ...reserved,
    cartId: audit.cartId,
    auditId: audit.auditId,
    subtotal,
    newTotal: subtotal - reserved.discountAmount,
  };
}
