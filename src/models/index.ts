import { Campaign } from './campaign.model';
import { Coupon } from './coupon.model';
import { CouponReservation } from './couponReservation.model';
import { PricingAudit } from './pricingAudit.model';

export async function initModels(): Promise<void> {
  await Promise.all([Campaign, Coupon, CouponReservation, PricingAudit].map((m) => m.init()));
}
