import { Router } from 'express';
import type { RequestHandler } from 'express';
import { calculate } from '../controllers/pricing.controller';
import { getById } from '../controllers/audit.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireRole } from '../middlewares/authorize';
import { calculateRequestSchema } from '../dtos/pricing.dto';
import { auditParamsSchema } from '../dtos/audit.dto';

export function createPricingRouter(authenticate: RequestHandler): Router {
  const router = Router();
  const anyUser = requireRole('customer', 'admin');
  router.post(
    '/calculate',
    authenticate,
    anyUser,
    validate('body', calculateRequestSchema),
    asyncHandler(calculate),
  );
  router.get(
    '/audit/:auditId',
    authenticate,
    anyUser,
    validate('params', auditParamsSchema),
    asyncHandler(getById),
  );
  return router;
}
