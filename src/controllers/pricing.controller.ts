import type { Request, Response } from 'express';
import { calculatePricing } from '../services/pricing.service';
import { resolvePricingOwner } from '../services/pricing.owner';
import { AppError } from '../errors/AppError';
import type { CalculateRequest } from '../dtos/pricing.dto';

export async function calculate(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  const owned = resolvePricingOwner(req.body as CalculateRequest, req.auth);
  const data = await calculatePricing(owned);
  res.status(200).json({ data });
}
