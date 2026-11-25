import { Campaign } from './campaign.model';
import { Coupon } from './coupon.model';
import { CouponReservation } from './couponReservation.model';
import { PricingAudit } from './pricingAudit.model';
import { Product } from './product.model';
import { User } from './user.model';

export async function initModels(): Promise<void> {
  await Promise.all(
    [Campaign, Coupon, CouponReservation, PricingAudit, Product, User].map((m) => m.init()),
  );
  // Replaces the legacy non-partial {couponCode, cartId} unique index on existing databases.
  await CouponReservation.syncIndexes();
}
