import { Coupon } from '../models/coupon.model';
import { AppError } from '../errors/AppError';
import { selectShipping, shippingOptionsFor } from '../config/shipping';
import type { ShippingOption } from '../config/shipping';
import type { AuditSnapshot } from '../dtos/audit.dto';
import { couponDiscount } from './coupon.discount';
import { priceCart } from './pricing.price';
import { withLineTotals } from './pricing.response';
import type { QuoteItem } from './pricing.response';
import { getUserTier } from './user.tier';

export interface RepricedOrder {
  items: QuoteItem[];
  subtotal: number;
  totalDiscount: number;
  couponDiscount: number;
  shipping: ShippingOption;
  grandTotal: number;
  currency: string;
}

const priceChanged = (): AppError =>
  new AppError(409, 'PRICE_CHANGED', 'Prices changed since your quote; please recalculate');

/**
 * Prices the audit's SKUs and quantities again from current server data and the owner's
 * current tier. Any difference from what the customer was quoted is a PRICE_CHANGED.
 */
export async function repriceAudit(
  audit: AuditSnapshot,
  shipping: ShippingOption,
  now: Date,
): Promise<RepricedOrder> {
  const context = { ...audit.context, customerTier: await getUserTier(audit.context.userId ?? '') };
  const inputs = audit.items.map((i) => ({ sku: i.sku, quantity: i.quantity }));
  const { items, result } = await priceCart(inputs, context, now);
  let discount = 0;
  if (audit.coupon) {
    const coupon = await Coupon.findOne({ code: audit.coupon.code }).lean();
    if (!coupon) {
      throw new AppError(409, 'COUPON_RESERVATION_INVALID', 'Coupon reservation is not valid');
    }
    discount = couponDiscount(coupon.discountType, coupon.value, result.total);
  }
  const current = selectShipping(shippingOptionsFor(result.total - discount), shipping.method);
  const unchanged =
    result.subtotal === audit.result.subtotal &&
    result.totalDiscount === audit.result.totalDiscount &&
    result.total === audit.result.total &&
    discount === (audit.coupon?.discountAmount ?? 0) &&
    current?.amount === shipping.amount;
  if (!current || !unchanged) throw priceChanged();
  return {
    items: withLineTotals(items),
    subtotal: result.subtotal,
    totalDiscount: result.totalDiscount,
    couponDiscount: discount,
    shipping: current,
    grandTotal: result.total - discount + current.amount,
    currency: result.currency,
  };
}
