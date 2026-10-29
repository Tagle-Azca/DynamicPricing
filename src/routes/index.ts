import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createPricingRouter } from './pricing.routes';
import { createCouponRouter } from './coupon.routes';
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
}

export function createApiRouter(deps: ApiDeps): Router {
  const router = Router();
  const auth: RequestHandler = authenticate(deps.tokens);
  const controller = createAuthController(createAuthService(deps.tokens, deps.bcryptRounds));
  router.use(
    '/auth',
    createAuthRouter({ controller, authLimiter: deps.limiters.auth, authenticate: auth }),
  );
  router.use('/pricing', createPricingRouter(auth));
  router.use('/coupons', createCouponRouter(auth, deps.limiters.coupon));
  router.use('/admin', createAdminRouter(auth));
  return router;
}
