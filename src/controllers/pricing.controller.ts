import type { Request, Response } from 'express';
import { calculatePricing } from '../services/pricing.service';
import type { CalculateRequest } from '../dtos/pricing.dto';

export async function calculate(req: Request, res: Response): Promise<void> {
  const data = await calculatePricing(req.body as CalculateRequest);
  res.status(200).json({ data });
}
