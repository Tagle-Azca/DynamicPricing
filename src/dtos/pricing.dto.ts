import { z } from 'zod';

const cents = z.number().int().nonnegative();

export const cartItemSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().max(200).optional(),
  category: z.string().min(1).max(64),
  unitPrice: cents,
  quantity: z.number().int().min(1),
});

export const pricingContextSchema = z.object({
  userId: z.string().min(1).max(128),
  customerTier: z.enum(['standard', 'gold', 'platinum']).optional(),
  currency: z.string().length(3).default('USD'),
  channel: z.string().max(64).optional(),
});

export const calculateRequestSchema = z.object({
  cartId: z.string().min(1).max(128),
  items: z.array(cartItemSchema).min(1).max(100),
  context: pricingContextSchema,
});

export type CartItem = z.infer<typeof cartItemSchema>;
export type PricingContext = z.infer<typeof pricingContextSchema>;
export type CalculateRequest = z.infer<typeof calculateRequestSchema>;

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
