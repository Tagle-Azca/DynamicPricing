import { Coupon } from '../../src/models/coupon.model';
import type { CouponDoc } from '../../src/models/coupon.model';

export async function createCoupon(
  code: string,
  overrides: Partial<CouponDoc> = {},
): Promise<CouponDoc> {
  const maxUses = overrides.maxUses ?? 10;
  const doc: CouponDoc = {
    code,
    discountType: 'percentage',
    value: 10,
    maxUses,
    remainingUses: maxUses,
    minSubtotal: 0,
    currency: 'USD',
    expiresAt: new Date(Date.now() + 86_400_000),
    isActive: true,
    perUserLimit: 1,
    ...overrides,
  };
  await Coupon.create(doc);
  return doc;
}

export async function remaining(code: string): Promise<number> {
  const coupon = await Coupon.findOne({ code }).lean();
  return coupon?.remainingUses ?? -1;
}
