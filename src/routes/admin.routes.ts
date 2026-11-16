import { Router } from 'express';
import type { RequestHandler } from 'express';
import * as h from '../controllers/admin.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { requireRole } from '../middlewares/authorize';
import * as audit from '../dtos/adminAudit.dto';
import * as campaign from '../dtos/adminCampaign.dto';
import * as coupon from '../dtos/adminCoupon.dto';
import { createAdminRegionsRouter } from './adminRegions.routes';

export function createAdminRouter(authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate, requireRole('admin'));

  router.get(
    '/audits',
    validate('query', audit.listAuditsQuerySchema),
    asyncHandler(h.listAuditsHandler),
  );
  router.get(
    '/audits/export',
    validate('query', audit.exportAuditsQuerySchema),
    asyncHandler(h.exportAuditsHandler),
  );
  router.get(
    '/audits/:auditId',
    validate('params', audit.adminAuditParamsSchema),
    asyncHandler(h.getAuditHandler),
  );

  router.get('/campaigns', asyncHandler(h.listCampaignsHandler));
  router.post(
    '/campaigns',
    validate('body', campaign.createCampaignSchema),
    asyncHandler(h.createCampaignHandler),
  );
  router.patch(
    '/campaigns/:code',
    validate('params', coupon.codeParamsSchema),
    validate('body', campaign.updateCampaignSchema),
    asyncHandler(h.updateCampaignHandler),
  );

  router.get('/coupons', asyncHandler(h.listCouponsHandler));
  router.post(
    '/coupons',
    validate('body', coupon.createCouponSchema),
    asyncHandler(h.createCouponHandler),
  );
  router.patch(
    '/coupons/:code',
    validate('params', coupon.codeParamsSchema),
    validate('body', coupon.updateCouponSchema),
    asyncHandler(h.updateCouponHandler),
  );
  router.use(createAdminRegionsRouter());
  return router;
}
