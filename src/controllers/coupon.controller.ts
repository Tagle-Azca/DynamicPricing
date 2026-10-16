import type { Request, Response } from 'express';
import { applyCoupon } from '../services/coupon.service';
import type { ApplyCouponRequest } from '../dtos/coupon.dto';

export async function apply(req: Request, res: Response): Promise<void> {
  const data = await applyCoupon(req.body as ApplyCouponRequest);
  res.status(200).json({ data });
}
