import { z } from 'zod';
import { cents, regionCode, strictDate, upperCode } from './admin.common.dto';

const list = z.array(z.string().min(1).max(64)).min(1).max(50);
const tiers = z.array(z.enum(['standard', 'gold', 'platinum'])).min(1);
const regions = z.array(regionCode).min(1).max(50);

const conditionsSchema = z
  .object({
    minSubtotal: cents.optional(),
    skus: list.optional(),
    categories: list.optional(),
    customerTiers: tiers.optional(),
    regions: regions.optional(),
  })
  .strict();

const conditionsPatchSchema = z
  .object({
    minSubtotal: cents.nullable().optional(),
    skus: list.nullable().optional(),
    categories: list.nullable().optional(),
    customerTiers: tiers.nullable().optional(),
    regions: regions.nullable().optional(),
  })
  .strict();

const campaignFields = {
  name: z.string().min(1).max(200),
  type: z.enum(['percentage', 'fixed']),
  value: cents,
  priority: z.number().int().min(0).max(10000).default(0),
  stackable: z.boolean().default(true),
  startsAt: strictDate,
  endsAt: strictDate,
  isActive: z.boolean().default(true),
  conditions: conditionsSchema.default({}),
};

function percentageInRange(v: { type?: string; value?: number }): boolean {
  return !(v.type === 'percentage' && v.value !== undefined && v.value > 100);
}

export const createCampaignSchema = z
  .object({ code: upperCode, ...campaignFields })
  .strict()
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
  .refine(percentageInRange, { message: 'percentage value must be <= 100', path: ['value'] });

export const updateCampaignSchema = z
  .object({
    name: campaignFields.name,
    type: campaignFields.type,
    value: campaignFields.value,
    priority: campaignFields.priority,
    stackable: campaignFields.stackable,
    startsAt: campaignFields.startsAt,
    endsAt: campaignFields.endsAt,
    isActive: campaignFields.isActive,
    conditions: conditionsPatchSchema,
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' })
  .refine(percentageInRange, { message: 'percentage value must be <= 100', path: ['value'] });

export type CreateCampaign = z.infer<typeof createCampaignSchema>;
export type UpdateCampaign = z.infer<typeof updateCampaignSchema>;
