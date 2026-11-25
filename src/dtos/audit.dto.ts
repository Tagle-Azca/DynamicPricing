import { z } from 'zod';
import type { AuditCoupon, CartItem, PricingContext, PricingResult } from './pricing.dto';

export const auditParamsSchema = z.object({
  auditId: z.string().uuid(),
});

export interface AuditSnapshot {
  auditId: string;
  cartId: string;
  context: PricingContext;
  items: CartItem[];
  result: PricingResult;
  coupon?: AuditCoupon;
  checksum: string;
  createdAt: Date;
}
