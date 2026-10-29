import { Router } from 'express';
import type { RequestHandler } from 'express';
import { listAuditsHandler } from '../controllers/admin.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireRole } from '../middlewares/authorize';
import { listAuditsQuerySchema } from '../dtos/admin.dto';

export function createAdminRouter(authenticate: RequestHandler): Router {
  const router = Router();
  router.get(
    '/audits',
    authenticate,
    requireRole('admin'),
    validate('query', listAuditsQuerySchema),
    asyncHandler(listAuditsHandler),
  );
  return router;
}
