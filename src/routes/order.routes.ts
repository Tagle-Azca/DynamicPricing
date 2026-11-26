import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createOrderHandler } from '../controllers/order.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireRole } from '../middlewares/authorize';
import { createOrderSchema } from '../dtos/order.dto';

export function createOrderRouter(
  authenticate: RequestHandler,
  ordersLimiter: RequestHandler,
  auditQuoteTtlSeconds: number,
): Router {
  const router = Router();
  router.post(
    '/',
    authenticate,
    requireRole('customer', 'admin'),
    ordersLimiter,
    validate('body', createOrderSchema),
    asyncHandler(createOrderHandler(auditQuoteTtlSeconds)),
  );
  return router;
}
