import { Order } from '../models/order.model';
import type { OrderDoc } from '../models/order.model';
import { PricingAudit } from '../models/pricingAudit.model';
import { AppError } from '../errors/AppError';
import type { AuditSnapshot } from '../dtos/audit.dto';
import type { CreateOrderRequest, OrderBody } from '../dtos/order.dto';
import { repriceAudit } from './order.reprice';
import { placeOrder } from './order.place';

export interface OrderResult {
  order: OrderBody;
  created: boolean;
}

export function toOrderBody(doc: OrderDoc): OrderBody {
  return {
    orderNumber: doc.orderNumber,
    status: doc.status,
    payment: doc.payment,
    items: doc.items,
    subtotal: doc.subtotal,
    totalDiscount: doc.totalDiscount,
    couponDiscount: doc.couponDiscount,
    savings: doc.savings,
    shipping: doc.shipping,
    grandTotal: doc.grandTotal,
    currency: doc.currency,
    contact: doc.contact,
    address: doc.address,
    ...(doc.coupon ? { coupon: doc.coupon } : {}),
    createdAt: doc.createdAt,
  };
}

async function loadOwnedAudit(auditId: string, userId: string): Promise<AuditSnapshot> {
  const audit = await PricingAudit.findOne({
    auditId: { $eq: auditId },
    'context.userId': { $eq: userId },
  })
    .select('-_id')
    .lean<AuditSnapshot>();
  if (!audit) throw new AppError(404, 'AUDIT_NOT_FOUND', `Audit ${auditId} not found`);
  return audit;
}

/** Turns a quoted audit into an order. All amounts come from re-pricing, never from the body. */
export async function createOrder(
  body: CreateOrderRequest,
  userId: string,
  auditQuoteTtlSeconds: number,
  now: Date = new Date(),
): Promise<OrderResult> {
  const audit = await loadOwnedAudit(body.auditId, userId);
  const replay = await Order.findOne({ auditId: audit.auditId, userId }).lean();
  if (replay) return { order: toOrderBody(replay), created: false };
  if (audit.createdAt.getTime() < now.getTime() - auditQuoteTtlSeconds * 1000) {
    throw new AppError(409, 'AUDIT_STALE', 'Audit is too old; recalculate the cart', {
      auditQuoteTtlSeconds,
    });
  }
  if (!audit.shipping) {
    throw new AppError(422, 'DELIVERY_REQUIRED', 'Choose a delivery method before ordering');
  }
  const region = audit.context.region;
  if (region && region !== body.address.region) {
    throw new AppError(422, 'REGION_MISMATCH', 'Address region differs from the quoted region');
  }
  const priced = await repriceAudit(audit, audit.shipping, now);
  const placed = await placeOrder(audit, userId, priced, body, now);
  return { order: toOrderBody(placed.order), created: placed.created };
}
