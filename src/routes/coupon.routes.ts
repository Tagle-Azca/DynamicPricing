import { Router } from 'express';
import { apply } from '../controllers/coupon.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import { applyCouponSchema } from '../dtos/coupon.dto';

export const couponRouter = Router();

couponRouter.post('/apply', validate('body', applyCouponSchema), asyncHandler(apply));
