import { Router } from 'express';
import type { RequestHandler } from 'express';
import { listActive } from '../controllers/campaign.controller';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireRole } from '../middlewares/authorize';

export function createCampaignRouter(authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/active', authenticate, requireRole('customer', 'admin'), asyncHandler(listActive));
  return router;
}
