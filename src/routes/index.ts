import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createPricingRouter } from './pricing.routes';
import { createCatalogRouter } from './catalog.routes';
import { createCouponRouter } from './coupon.routes';
import { createOrderRouter } from './order.routes';
import { createCampaignRouter } from './campaign.routes';
import { createAuthRouter } from './auth.routes';
import { createAdminRouter } from './admin.routes';
import { createAuthController } from '../controllers/auth.controller';
import { createAuthService } from '../services/auth.service';
import { authenticate } from '../middlewares/authenticate';
import type { Limiters } from '../middlewares/rateLimiters';
import type { TokenService } from '../services/token.service';

export interface ApiDeps {
  tokens: TokenService;
  limiters: Limiters;
  bcryptRounds: number;
  reservationTtlSeconds: number;
  auditQuoteTtlSeconds: number;
}

export function createApiRouter(deps: ApiDeps): Router {
  const router = Router();
  const auth: RequestHandler = authenticate(deps.tokens);
  const controller = createAuthController(createAuthService(deps.tokens, deps.bcryptRounds));
  router.use(
    '/auth',
    createAuthRouter({ controller, authLimiter: deps.limiters.auth, authenticate: auth }),
  );
  router.use('/catalog', createCatalogRouter(auth));
  router.use(
    '/pricing',
    createPricingRouter(auth, deps.limiters.coupon, deps.reservationTtlSeconds),
  );
  router.use(
    '/coupons',
    createCouponRouter(
      auth,
      deps.limiters.coupon,
      deps.reservationTtlSeconds,
      deps.auditQuoteTtlSeconds,
    ),
  );
  router.use('/campaigns', createCampaignRouter(auth));
  router.use('/orders', createOrderRouter(auth, deps.limiters.orders, deps.auditQuoteTtlSeconds));
  router.use('/admin', createAdminRouter(auth));
  return router;
}
