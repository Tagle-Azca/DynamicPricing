import type { Request, Response } from 'express';
import { applyCoupon } from '../services/coupon.service';
import { releaseReservation } from '../services/coupon.release';
import { AppError } from '../errors/AppError';
import type { ApplyCouponRequest } from '../dtos/coupon.dto';

export function createApplyHandler(
  reservationTtlSeconds: number,
  auditQuoteTtlSeconds: number,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    if (!req.auth) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
    const data = await applyCoupon(
      req.body as ApplyCouponRequest,
      req.auth.sub,
      reservationTtlSeconds,
      auditQuoteTtlSeconds,
    );
    res.status(201).json({ data });
  };
}

export async function release(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  const data = await releaseReservation(String(req.params.id), req.auth.sub);
  res.status(200).json({ data });
}
