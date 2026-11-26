import type { Request, Response } from 'express';
import { createOrder } from '../services/order.service';
import { AppError } from '../errors/AppError';
import type { CreateOrderRequest } from '../dtos/order.dto';

export function createOrderHandler(
  auditQuoteTtlSeconds: number,
): (req: Request, res: Response) => Promise<void> {
  return async (req, res) => {
    if (!req.auth) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
    const { order, created } = await createOrder(
      req.body as CreateOrderRequest,
      req.auth.sub,
      auditQuoteTtlSeconds,
    );
    res.status(created ? 201 : 200).json({ data: order });
  };
}
