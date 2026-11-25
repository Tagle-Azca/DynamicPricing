import { z } from 'zod';
import { currencyCode } from './admin.common.dto';

export const cartItemInputSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .transform((v) => v.toUpperCase()),
    quantity: z.number().int().min(1).max(10000),
  })
  .strict();

export const pricingContextSchema = z.object({
  userId: z.string().min(1).max(128).optional(),
  customerTier: z.enum(['standard', 'gold', 'platinum']).optional(),
  currency: currencyCode.default('USD'),
  channel: z.string().max(64).optional(),
  region: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((v) => v.toUpperCase())
    .optional(),
});

export const calculateRequestSchema = z.object({
  cartId: z.string().min(1).max(128),
  items: z.array(cartItemInputSchema).min(1).max(100),
  context: pricingContextSchema,
  couponCode: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((v) => v.toUpperCase())
    .optional(),
});

export type CartItemInput = z.infer<typeof cartItemInputSchema>;
export type PricingContext = z.infer<typeof pricingContextSchema>;
export type CalculateRequest = z.infer<typeof calculateRequestSchema>;

/** Item resolved server-side from the product catalog; this is what audits store. */
export interface CartItem {
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  quantity: number;
}

export interface AppliedRule {
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  discount: number;
}

export interface SkippedRule {
  code: string;
  reason: string;
}

export interface PricingResult {
  subtotal: number;
  appliedRules: AppliedRule[];
  skippedRules: SkippedRule[];
  totalDiscount: number;
  total: number;
  currency: string;
}

export interface AuditCoupon {
  code: string;
  discountAmount: number;
  reservationId: string;
  expiresAt: string;
}
