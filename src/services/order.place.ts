import mongoose from 'mongoose';
import { Order } from '../models/order.model';
import type { OrderDoc } from '../models/order.model';
import { CouponReservation } from '../models/couponReservation.model';
import { AppError } from '../errors/AppError';
import type { AuditSnapshot } from '../dtos/audit.dto';
import type { CreateOrderRequest } from '../dtos/order.dto';
import { generateOrderNumber } from './order.number';
import type { RepricedOrder } from './order.reprice';

export interface PlacedOrder {
  order: OrderDoc;
  created: boolean;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 11000;
}

async function writeOrder(
  audit: AuditSnapshot,
  userId: string,
  priced: RepricedOrder,
  body: CreateOrderRequest,
  now: Date,
): Promise<PlacedOrder> {
  const { auditId } = audit;
  return mongoose.connection.transaction(async (session) => {
    const existing = await Order.findOne({ auditId, userId }).session(session).lean();
    if (existing) return { order: existing, created: false };
    // A reservation made after the quote (legacy /coupons/apply) changes what the customer saw.
    const stray = await CouponReservation.exists({
      auditId,
      status: 'RESERVED',
      expiresAt: mongoose.trusted({ $gt: now }),
      ...(audit.coupon ? { _id: mongoose.trusted({ $ne: audit.coupon.reservationId }) } : {}),
    }).session(session);
    if (stray) {
      throw new AppError(409, 'COUPON_RESERVATION_INVALID', 'Coupon reservation is not valid');
    }
    if (audit.coupon) {
      // Atomic RESERVED -> CONSUMED; fails if released, expired or taken by a concurrent order.
      const consumed = await CouponReservation.findOneAndUpdate(
        {
          _id: audit.coupon.reservationId,
          userId,
          auditId,
          couponCode: audit.coupon.code,
          status: 'RESERVED',
          expiresAt: mongoose.trusted({ $gt: now }),
        },
        { $set: { status: 'CONSUMED', consumedAt: now } },
        { session },
      );
      if (!consumed) {
        throw new AppError(409, 'COUPON_RESERVATION_INVALID', 'Coupon reservation is not valid');
      }
    }
    const couponDiscount = priced.couponDiscount;
    const [created] = await Order.create(
      [
        {
          orderNumber: generateOrderNumber(),
          auditId,
          userId,
          status: 'CONFIRMED',
          payment: 'DEMO_NOT_CHARGED',
          items: priced.items,
          subtotal: priced.subtotal,
          totalDiscount: priced.totalDiscount,
          couponDiscount,
          savings: priced.totalDiscount + couponDiscount,
          shipping: priced.shipping,
          grandTotal: priced.grandTotal,
          currency: priced.currency,
          contact: body.contact,
          address: body.address,
          ...(audit.coupon
            ? { coupon: { code: audit.coupon.code, discountAmount: couponDiscount } }
            : {}),
          createdAt: now,
        },
      ],
      { session },
    );
    if (!created) throw new AppError(500, 'INTERNAL_ERROR', 'Order creation failed');
    return { order: created.toObject(), created: true };
  });
}

/** Creates the order and consumes the coupon in one transaction; retries order-number clashes. */
export async function placeOrder(
  audit: AuditSnapshot,
  userId: string,
  priced: RepricedOrder,
  body: CreateOrderRequest,
  now: Date,
): Promise<PlacedOrder> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await writeOrder(audit, userId, priced, body, now);
    } catch (err) {
      if (!isDuplicateKey(err)) throw err;
      // A concurrent request for the same audit won the race: replay its order.
      const winner = await Order.findOne({ auditId: audit.auditId, userId }).lean();
      if (winner) return { order: winner, created: false };
    }
  }
  throw new AppError(500, 'INTERNAL_ERROR', 'Could not allocate an order number');
}
