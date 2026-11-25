import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createCalculateHandler } from '../controllers/pricing.controller';
import { getById } from '../controllers/audit.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireRole } from '../middlewares/authorize';
import { calculateRequestSchema } from '../dtos/pricing.dto';
import { auditParamsSchema } from '../dtos/audit.dto';

/** Coupon guesses through /calculate share the per-subject coupon limiter. */
function whenCouponCode(limiter: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const { couponCode } = req.body as { couponCode?: string };
    if (couponCode) limiter(req, res, next);
    else next();
  };
}

export function createPricingRouter(
  authenticate: RequestHandler,
  couponLimiter: RequestHandler,
  reservationTtlSeconds: number,
): Router {
  const router = Router();
  const anyUser = requireRole('customer', 'admin');
  router.post(
    '/calculate',
    authenticate,
    anyUser,
    validate('body', calculateRequestSchema),
    whenCouponCode(couponLimiter),
    asyncHandler(createCalculateHandler(reservationTtlSeconds)),
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
