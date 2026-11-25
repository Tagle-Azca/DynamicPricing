import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createApplyHandler, release } from '../controllers/coupon.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireRole } from '../middlewares/authorize';
import { applyCouponSchema, reservationParamsSchema } from '../dtos/coupon.dto';

export function createCouponRouter(
  authenticate: RequestHandler,
  couponLimiter: RequestHandler,
  reservationTtlSeconds: number,
  auditQuoteTtlSeconds: number,
): Router {
  const router = Router();
  const anyUser = requireRole('customer', 'admin');
  router.post(
    '/apply',
    authenticate,
    anyUser,
    couponLimiter,
    validate('body', applyCouponSchema),
    asyncHandler(createApplyHandler(reservationTtlSeconds, auditQuoteTtlSeconds)),
  );
  router.delete(
    '/reservations/:id',
    authenticate,
    anyUser,
    couponLimiter,
    validate('params', reservationParamsSchema),
    asyncHandler(release),
  );
  return router;
}
