import type { CampaignDoc } from '../models/campaign.model';
import type { CartItem, PricingContext, PricingResult } from '../dtos/pricing.dto';

export interface NextThreshold {
  code: string;
  name: string;
  minSubtotal: number;
  remaining: number;
  progressPercent: number;
}

function reachableByCaller(c: CampaignDoc, items: CartItem[], context: PricingContext): boolean {
  const { customerTiers, regions, skus, categories } = c.conditions ?? {};
  if (
    customerTiers?.length &&
    !(context.customerTier && customerTiers.includes(context.customerTier))
  ) {
    return false;
  }
  if (regions?.length && !(context.region && regions.includes(context.region))) return false;
  if (!skus?.length && !categories?.length) return true;
  return items.some((i) => skus?.includes(i.sku) || categories?.includes(i.category));
}

/** The closest campaign the caller could still unlock by adding to the cart, if any. */
export function findNextThreshold(
  campaigns: CampaignDoc[],
  items: CartItem[],
  context: PricingContext,
  result: PricingResult,
): NextThreshold | undefined {
  const missed = new Set(
    result.skippedRules.filter((r) => r.reason === 'MIN_SUBTOTAL_NOT_MET').map((r) => r.code),
  );
  const candidates: NextThreshold[] = [];
  for (const c of campaigns) {
    const min = c.conditions?.minSubtotal;
    if (!missed.has(c.code) || min === undefined || min <= result.subtotal) continue;
    if (!reachableByCaller(c, items, context)) continue;
    candidates.push({
      code: c.code,
      name: c.name,
      minSubtotal: min,
      remaining: min - result.subtotal,
      progressPercent: Math.floor((100 * result.subtotal) / min),
    });
  }
  candidates.sort((a, b) => a.remaining - b.remaining || a.code.localeCompare(b.code));
  return candidates[0];
}
