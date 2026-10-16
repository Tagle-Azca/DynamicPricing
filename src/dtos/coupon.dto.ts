import { z } from 'zod';

export const applyCouponSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(64)
    .transform((v) => v.toUpperCase()),
  cartId: z.string().min(1).max(128),
  subtotal: z.number().int().nonnegative(),
});

export type ApplyCouponRequest = z.infer<typeof applyCouponSchema>;

export interface ApplyCouponResponse {
  status: 'RESERVED';
  reservationId: string;
  code: string;
  cartId: string;
  subtotal: number;
  discountAmount: number;
  newTotal: number;
  remainingUses: number;
}
