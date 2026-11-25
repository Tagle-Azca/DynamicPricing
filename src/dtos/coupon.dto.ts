import { z } from 'zod';

export const applyCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .transform((v) => v.toUpperCase()),
    auditId: z.string().uuid(),
  })
  .strict();

export const reservationParamsSchema = z.object({ id: z.string().regex(/^[0-9a-f]{24}$/i) });

export type ApplyCouponRequest = z.infer<typeof applyCouponSchema>;

export interface ReserveResult {
  reservationId: string;
  code: string;
  discountAmount: number;
  remainingUses: number;
  expiresAt: Date;
}

export interface ApplyCouponResponse extends ReserveResult {
  status: 'RESERVED';
  cartId: string;
  auditId: string;
  subtotal: number;
  newTotal: number;
}

export interface ReleaseResponse {
  status: 'RELEASED';
  reservationId: string;
  remainingUses: number;
}
