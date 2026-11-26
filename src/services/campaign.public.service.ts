import mongoose from 'mongoose';
import { Campaign } from '../models/campaign.model';
import type { Tier } from '../dtos/auth.dto';

export interface PublicCampaign {
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  minSubtotal?: number;
  endsAt: Date;
}

const MAX_CAMPAIGNS = 5;

const typeRank = (type: string): number => (type === 'percentage' ? 0 : 1);

/** Percentage campaigns first, then fixed; value desc inside each group; code as tie-break. */
function byTypeThenValue(
  a: { type: string; value: number; code: string },
  b: { type: string; value: number; code: string },
): number {
  return typeRank(a.type) - typeRank(b.type) || b.value - a.value || a.code.localeCompare(b.code);
}

/** Active campaigns the given tier could receive, reduced to storefront-safe fields. */
export async function listActiveCampaigns(
  tier: Tier,
  now: Date = new Date(),
): Promise<PublicCampaign[]> {
  const docs = await Campaign.find({
    isActive: true,
    startsAt: mongoose.trusted({ $lte: now }),
    endsAt: mongoose.trusted({ $gt: now }),
  }).lean();
  return docs
    .filter(
      (c) => !c.conditions?.customerTiers?.length || c.conditions.customerTiers.includes(tier),
    )
    .sort(byTypeThenValue)
    .slice(0, MAX_CAMPAIGNS)
    .map((c) => ({
      code: c.code,
      name: c.name,
      type: c.type,
      value: c.value,
      ...(c.conditions?.minSubtotal !== undefined ? { minSubtotal: c.conditions.minSubtotal } : {}),
      endsAt: c.endsAt,
    }));
}
