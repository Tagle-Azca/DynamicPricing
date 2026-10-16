import type { CampaignDoc } from '../models/campaign.model';
import type {
  AppliedRule,
  CartItem,
  PricingContext,
  PricingResult,
  SkippedRule,
} from '../dtos/pricing.dto';

export function computeSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

export function sortCampaigns(campaigns: CampaignDoc[]): CampaignDoc[] {
  return [...campaigns].sort((a, b) => b.priority - a.priority || a.code.localeCompare(b.code));
}

interface Eligibility {
  eligible: boolean;
  reason?: string;
  base: number;
}

function evaluateConditions(
  c: CampaignDoc,
  items: CartItem[],
  context: PricingContext,
  subtotal: number,
): Eligibility {
  const { minSubtotal, skus, categories, customerTiers } = c.conditions ?? {};
  if (minSubtotal !== undefined && subtotal < minSubtotal) {
    return { eligible: false, reason: 'MIN_SUBTOTAL_NOT_MET', base: 0 };
  }
  if (
    customerTiers?.length &&
    (!context.customerTier || !customerTiers.includes(context.customerTier))
  ) {
    return { eligible: false, reason: 'CUSTOMER_TIER_NOT_ELIGIBLE', base: 0 };
  }
  if (!skus?.length && !categories?.length) {
    return { eligible: true, base: subtotal };
  }
  const matching = items.filter((i) => skus?.includes(i.sku) || categories?.includes(i.category));
  if (matching.length === 0) return { eligible: false, reason: 'NO_ELIGIBLE_ITEMS', base: 0 };
  return { eligible: true, base: computeSubtotal(matching) };
}

function discountFor(c: CampaignDoc, base: number, remaining: number): number {
  const raw = c.type === 'percentage' ? Math.round((base * c.value) / 100) : c.value;
  return Math.max(0, Math.min(raw, remaining));
}

export function evaluateCampaigns(
  campaigns: CampaignDoc[],
  items: CartItem[],
  context: PricingContext,
): PricingResult {
  const subtotal = computeSubtotal(items);
  const appliedRules: AppliedRule[] = [];
  const skippedRules: SkippedRule[] = [];
  let remaining = subtotal;
  let stopped = false;

  for (const c of sortCampaigns(campaigns)) {
    if (stopped) {
      skippedRules.push({ code: c.code, reason: 'NON_STACKABLE_RULE_ALREADY_APPLIED' });
      continue;
    }
    const check = evaluateConditions(c, items, context, subtotal);
    if (!check.eligible) {
      skippedRules.push({ code: c.code, reason: check.reason ?? 'NOT_ELIGIBLE' });
      continue;
    }
    if (!c.stackable && appliedRules.length > 0) {
      skippedRules.push({ code: c.code, reason: 'NON_STACKABLE_AFTER_OTHER_RULES' });
      continue;
    }
    const discount = discountFor(c, check.base, remaining);
    if (discount === 0) {
      skippedRules.push({ code: c.code, reason: 'ZERO_DISCOUNT' });
      continue;
    }
    remaining -= discount;
    appliedRules.push({ code: c.code, name: c.name, type: c.type, value: c.value, discount });
    if (!c.stackable) stopped = true;
  }

  return {
    subtotal,
    appliedRules,
    skippedRules,
    totalDiscount: subtotal - remaining,
    total: remaining,
    currency: context.currency,
  };
}
