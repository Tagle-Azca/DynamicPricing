import { z } from 'zod';
import type { CartItem, PricingContext, PricingResult } from './pricing.dto';

export const auditParamsSchema = z.object({
  auditId: z.string().uuid(),
});

export interface AuditSnapshot {
  auditId: string;
  cartId: string;
  context: PricingContext;
  items: CartItem[];
  result: PricingResult;
  checksum: string;
  createdAt: Date;
}
