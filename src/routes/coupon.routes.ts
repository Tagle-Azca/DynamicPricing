import { Router } from 'express';
import type { RequestHandler } from 'express';
import { apply } from '../controllers/coupon.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireRole } from '../middlewares/authorize';
import { applyCouponSchema } from '../dtos/coupon.dto';

export function createCouponRouter(
  authenticate: RequestHandler,
  couponLimiter: RequestHandler,
): Router {
  const router = Router();
  router.post(
    '/apply',
    authenticate,
    requireRole('customer', 'admin'),
    couponLimiter,
    validate('body', applyCouponSchema),
    asyncHandler(apply),
  );
  return router;
}
