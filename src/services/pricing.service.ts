import mongoose from 'mongoose';
import { Campaign } from '../models/campaign.model';
import type { CalculateRequest, PricingResult } from '../dtos/pricing.dto';
import { evaluateCampaigns } from './pricing.rules';
import { recordAudit } from './audit.service';

export interface CalculateResponse extends PricingResult {
  auditId: string;
  cartId: string;
  calculatedAt: Date;
}

export async function calculatePricing(
  request: CalculateRequest,
  now: Date = new Date(),
): Promise<CalculateResponse> {
  const campaigns = await Campaign.find({
    isActive: true,
    startsAt: mongoose.trusted({ $lte: now }),
    endsAt: mongoose.trusted({ $gt: now }),
  }).lean();

  const result = evaluateCampaigns(campaigns, request.items, request.context);
  const { auditId, createdAt } = await recordAudit(request, result);

  return { auditId, cartId: request.cartId, ...result, calculatedAt: createdAt };
}
