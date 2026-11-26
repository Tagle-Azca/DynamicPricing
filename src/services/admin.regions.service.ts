import mongoose from 'mongoose';
import { Campaign } from '../models/campaign.model';
import type { CampaignDoc } from '../models/campaign.model';
import { AppError } from '../errors/AppError';

const HIDE = '-_id';
const FIELDS = 'code name type value isActive startsAt endsAt conditions';

export interface CampaignSummary {
  code: string;
  name: string;
  type: string;
  value: number;
  isActive: boolean;
  activeNow: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface RegionsOverview {
  regions: { region: string; campaigns: CampaignSummary[] }[];
  global: CampaignSummary[];
}

function summarize(c: CampaignDoc, now: Date, withDates: boolean): CampaignSummary {
  const base = {
    code: c.code,
    name: c.name,
    type: c.type,
    value: c.value,
    isActive: c.isActive,
    activeNow: c.isActive && c.startsAt <= now && now < c.endsAt,
  };
  return withDates
    ? { ...base, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString() }
    : base;
}

export async function listRegions(now: Date = new Date()): Promise<RegionsOverview> {
  const all = await Campaign.find({}).select(FIELDS).sort({ code: 1 }).lean();
  const byRegion = new Map<string, CampaignSummary[]>();
  const global: CampaignSummary[] = [];
  for (const c of all) {
    const regions = c.conditions?.regions ?? [];
    if (regions.length === 0) global.push(summarize(c, now, false));
    for (const r of regions) {
      byRegion.set(r, [...(byRegion.get(r) ?? []), summarize(c, now, true)]);
    }
  }
  const regions = [...byRegion.keys()].sort().map((region) => ({
    region,
    campaigns: byRegion.get(region) ?? [],
  }));
  return { regions, global };
}

function notFound(code: string): AppError {
  return new AppError(404, 'CAMPAIGN_NOT_FOUND', `Campaign ${code} not found`);
}

export async function addRegion(code: string, region: string): Promise<unknown> {
  const updated = await Campaign.findOneAndUpdate(
    { code },
    { $addToSet: { 'conditions.regions': region } },
    { returnDocument: 'after' },
  )
    .select(HIDE)
    .lean();
  if (!updated) throw notFound(code);
  return updated;
}

export async function removeRegion(code: string, region: string): Promise<unknown> {
  // Atomic: the pull only matches unless the list is exactly one element.
  const pulled = await Campaign.findOneAndUpdate(
    { code, 'conditions.regions': mongoose.trusted({ $eq: region, $not: { $size: 1 } }) },
    { $pull: { 'conditions.regions': region } },
    { returnDocument: 'after' },
  )
    .select(HIDE)
    .lean();
  if (pulled) return pulled;

  const current = await Campaign.findOne({ code }).select(HIDE).lean();
  if (!current) throw notFound(code);
  if (current.conditions?.regions?.includes(region)) {
    throw new AppError(
      409,
      'LAST_REGION',
      'Cannot remove the last region (it would apply everywhere); deactivate the campaign instead',
    );
  }
  return current;
}
