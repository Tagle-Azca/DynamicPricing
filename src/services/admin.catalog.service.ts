import { Campaign } from '../models/campaign.model';
import type { CampaignConditions } from '../models/campaign.model';
import { Coupon } from '../models/coupon.model';
import { AppError } from '../errors/AppError';
import type { CreateCampaign, UpdateCampaign } from '../dtos/adminCampaign.dto';
import type { CreateCoupon, UpdateCoupon } from '../dtos/adminCoupon.dto';

const HIDE = '-_id';

export async function createCampaign(input: CreateCampaign): Promise<unknown> {
  const doc = await Campaign.create(input);
  return Campaign.findById(doc._id).select(HIDE).lean();
}

export async function listCampaigns(): Promise<unknown[]> {
  return Campaign.find({}).select(HIDE).sort({ priority: -1, code: 1 }).lean();
}

function mergeConditions(
  existing: CampaignConditions | undefined,
  patch: NonNullable<UpdateCampaign['conditions']>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete merged[key];
    else if (value !== undefined) merged[key] = value;
  }
  return merged;
}

export async function updateCampaign(code: string, patch: UpdateCampaign): Promise<unknown> {
  const current = await Campaign.findOne({ code });
  if (!current) throw new AppError(404, 'CAMPAIGN_NOT_FOUND', `Campaign ${code} not found`);
  const merged = {
    type: patch.type ?? current.type,
    value: patch.value ?? current.value,
    startsAt: patch.startsAt ?? current.startsAt,
    endsAt: patch.endsAt ?? current.endsAt,
  };
  if (merged.endsAt <= merged.startsAt) {
    throw new AppError(400, 'VALIDATION_ERROR', 'endsAt must be after startsAt');
  }
  if (merged.type === 'percentage' && merged.value > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', 'percentage value must be <= 100');
  }
  const { conditions, ...rest } = patch;
  current.set(rest);
  if (conditions)
    current.set('conditions', mergeConditions(current.toObject().conditions, conditions));
  await current.save();
  return Campaign.findOne({ code }).select(HIDE).lean();
}

export async function createCoupon(input: CreateCoupon): Promise<unknown> {
  const doc = await Coupon.create({ ...input, remainingUses: input.maxUses });
  return Coupon.findById(doc._id).select(HIDE).lean();
}

export async function listCoupons(): Promise<unknown[]> {
  return Coupon.find({}).select(HIDE).sort({ code: 1 }).lean();
}

export async function updateCoupon(code: string, patch: UpdateCoupon): Promise<unknown> {
  const updated = await Coupon.findOneAndUpdate({ code }, { $set: patch }, { new: true })
    .select(HIDE)
    .lean();
  if (!updated) throw new AppError(404, 'COUPON_NOT_FOUND', `Coupon ${code} not found`);
  return updated;
}
