import type { Request, Response } from 'express';
import { applyCoupon } from '../services/coupon.service';
import { AppError } from '../errors/AppError';
import type { ApplyCouponRequest } from '../dtos/coupon.dto';

export async function apply(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  const data = await applyCoupon(req.body as ApplyCouponRequest, req.auth.sub);
  res.status(200).json({ data });
}
