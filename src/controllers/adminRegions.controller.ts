import type { Request, Response } from 'express';
import { addRegion, listRegions, removeRegion } from '../services/admin.regions.service';
import type { CampaignRegionParams } from '../dtos/adminRegion.dto';

export async function listRegionsHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await listRegions() });
}

export async function addRegionHandler(req: Request, res: Response): Promise<void> {
  const { code, region } = req.params as unknown as CampaignRegionParams;
  res.status(200).json({ data: await addRegion(code, region) });
}

export async function removeRegionHandler(req: Request, res: Response): Promise<void> {
  const { code, region } = req.params as unknown as CampaignRegionParams;
  res.status(200).json({ data: await removeRegion(code, region) });
}
