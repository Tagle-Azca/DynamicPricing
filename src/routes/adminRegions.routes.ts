import { Router } from 'express';
import * as h from '../controllers/adminRegions.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { campaignRegionParamsSchema } from '../dtos/adminRegion.dto';

/** Mounted inside the admin router, so authenticate + requireRole('admin') already ran. */
export function createAdminRegionsRouter(): Router {
  const router = Router();
  const params = validate('params', campaignRegionParamsSchema);
  router.get('/regions', asyncHandler(h.listRegionsHandler));
  router.put('/campaigns/:code/regions/:region', params, asyncHandler(h.addRegionHandler));
  router.delete('/campaigns/:code/regions/:region', params, asyncHandler(h.removeRegionHandler));
  return router;
}
