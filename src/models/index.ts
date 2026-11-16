import { Campaign } from './campaign.model';
import { Coupon } from './coupon.model';
import { CouponReservation } from './couponReservation.model';
import { PricingAudit } from './pricingAudit.model';
import { User } from './user.model';

export async function initModels(): Promise<void> {
  await Promise.all([Campaign, Coupon, CouponReservation, PricingAudit, User].map((m) => m.init()));
}
