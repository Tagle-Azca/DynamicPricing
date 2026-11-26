import { Campaign } from './campaign.model';
import { Coupon } from './coupon.model';
import { CouponReservation } from './couponReservation.model';
import { Order } from './order.model';
import { PricingAudit } from './pricingAudit.model';
import { Product } from './product.model';
import { User } from './user.model';
import { prepareReservationIndexes } from './reservationIndexes';

export async function initModels(): Promise<void> {
  await Promise.all(
    [Campaign, Coupon, CouponReservation, Order, PricingAudit, Product, User].map((m) => m.init()),
  );
  await prepareReservationIndexes();
}
