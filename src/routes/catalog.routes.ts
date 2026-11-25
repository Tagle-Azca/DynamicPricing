import { Router } from 'express';
import type { RequestHandler } from 'express';
import { list } from '../controllers/catalog.controller';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireRole } from '../middlewares/authorize';

export function createCatalogRouter(authenticate: RequestHandler): Router {
  const router = Router();
  router.get('/', authenticate, requireRole('customer', 'admin'), asyncHandler(list));
  return router;
}
