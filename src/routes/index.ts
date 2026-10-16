import { Router } from 'express';
import { pricingRouter } from './pricing.routes';
import { couponRouter } from './coupon.routes';

export const apiRouter = Router();

apiRouter.use('/pricing', pricingRouter);
apiRouter.use('/coupons', couponRouter);
