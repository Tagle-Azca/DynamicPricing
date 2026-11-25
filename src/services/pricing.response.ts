import type { CampaignDoc } from '../models/campaign.model';
import type { ShippingOption } from '../config/shipping';
import type { CartItem, PricingContext, PricingResult } from '../dtos/pricing.dto';
import type { ReserveResult } from '../dtos/coupon.dto';
import { findNextThreshold } from './pricing.threshold';
import type { NextThreshold } from './pricing.threshold';

export interface QuoteItem extends CartItem {
  lineTotal: number;
}

export interface CalculateResponse extends PricingResult {
  auditId: string;
  cartId: string;
  items: QuoteItem[];
  calculatedAt: Date;
  finalTotal: number;
  coupon?: ReserveResult;
  savings: number;
  shippingOptions: ShippingOption[];
  shipping?: ShippingOption;
  grandTotal?: number;
  nextThreshold?: NextThreshold;
}

export function withLineTotals(items: CartItem[]): QuoteItem[] {
  return items.map((i) => ({ ...i, lineTotal: i.unitPrice * i.quantity }));
}

export interface QuoteParts {
  auditId: string;
  cartId: string;
  items: CartItem[];
  result: PricingResult;
  context: PricingContext;
  campaigns: CampaignDoc[];
  calculatedAt: Date;
  coupon?: ReserveResult;
  shippingOptions: ShippingOption[];
  shipping?: ShippingOption;
}

/** Shapes the calculate response; every amount is derived from server-side values only. */
export function buildQuote(p: QuoteParts): CalculateResponse {
  const { result, coupon, shipping } = p;
  const couponDiscount = coupon?.discountAmount ?? 0;
  const finalTotal = result.total - couponDiscount;
  const nextThreshold = findNextThreshold(p.campaigns, p.items, p.context, result);
  return {
    auditId: p.auditId,
    cartId: p.cartId,
    items: withLineTotals(p.items),
    ...result,
    calculatedAt: p.calculatedAt,
    finalTotal,
    ...(coupon ? { coupon } : {}),
    savings: result.totalDiscount + couponDiscount,
    shippingOptions: p.shippingOptions,
    ...(shipping ? { shipping, grandTotal: finalTotal + shipping.amount } : {}),
    ...(nextThreshold ? { nextThreshold } : {}),
  };
}
