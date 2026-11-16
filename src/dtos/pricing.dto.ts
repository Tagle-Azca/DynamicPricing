import { z } from 'zod';

const cents = z.number().int().nonnegative();

export const cartItemSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().max(200).optional(),
  category: z.string().min(1).max(64),
  unitPrice: cents.max(1_000_000_000),
  quantity: z.number().int().min(1).max(10000),
});

export const pricingContextSchema = z.object({
  userId: z.string().min(1).max(128).optional(),
  customerTier: z.enum(['standard', 'gold', 'platinum']).optional(),
  currency: z.string().length(3).default('USD'),
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
