import { z } from 'zod';
import { cents, currencyCode, strictDate, upperCode } from './admin.common.dto';

const couponFields = {
  discountType: z.enum(['percentage', 'fixed']),
  value: cents,
  maxUses: z.number().int().min(1).max(1_000_000),
  minSubtotal: cents.default(0),
  currency: currencyCode.default('USD'),
  expiresAt: strictDate,
  isActive: z.boolean().default(true),
  userId: z.string().min(1).max(128).optional(),
  perUserLimit: z.number().int().min(1).max(1000).default(1),
};

export const createCouponSchema = z
  .object({ code: upperCode, ...couponFields })
  .strict()
  .refine((v) => v.discountType !== 'percentage' || v.value <= 100, {
    message: 'percentage value must be <= 100',
    path: ['value'],
  });

export const updateCouponSchema = z
  .object({
    isActive: couponFields.isActive,
    expiresAt: couponFields.expiresAt,
    minSubtotal: cents,
    currency: currencyCode,
    perUserLimit: couponFields.perUserLimit,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const codeParamsSchema = z.object({ code: upperCode });

export type CreateCoupon = z.infer<typeof createCouponSchema>;
export type UpdateCoupon = z.infer<typeof updateCouponSchema>;
