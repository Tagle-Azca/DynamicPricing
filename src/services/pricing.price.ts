import mongoose from 'mongoose';
import { Campaign } from '../models/campaign.model';
import type { CampaignDoc } from '../models/campaign.model';
import { AppError } from '../errors/AppError';
import type { CartItem, CartItemInput, PricingContext, PricingResult } from '../dtos/pricing.dto';
import { evaluateCampaigns } from './pricing.rules';
import { resolveItems } from './catalog.service';

export interface PricedCart {
  items: CartItem[];
  result: PricingResult;
  campaigns: CampaignDoc[];
}

/** Prices a cart from catalog and campaign data only; shared by calculate and order re-pricing. */
export async function priceCart(
  inputs: CartItemInput[],
  context: PricingContext,
  now: Date,
): Promise<PricedCart> {
  const items = await resolveItems(inputs, context.currency);
  const campaigns = await Campaign.find({
    isActive: true,
    startsAt: mongoose.trusted({ $lte: now }),
    endsAt: mongoose.trusted({ $gt: now }),
  }).lean();
  const result = evaluateCampaigns(campaigns, items, context);
  if (!Number.isSafeInteger(result.subtotal)) {
    throw new AppError(422, 'AMOUNT_TOO_LARGE', 'Cart subtotal exceeds the supported amount');
  }
  return { items, result, campaigns };
}
