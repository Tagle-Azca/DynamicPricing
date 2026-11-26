import type { Request, Response } from 'express';
import { listActiveCampaigns } from '../services/campaign.public.service';
import { getUserTier } from '../services/user.tier';
import { AppError } from '../errors/AppError';

export async function listActive(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  const campaigns = await listActiveCampaigns(await getUserTier(req.auth.sub));
  res.status(200).json({ data: campaigns });
}
