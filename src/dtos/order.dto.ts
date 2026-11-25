import { z } from 'zod';
import type { ShippingOption } from '../config/shipping';
import type { QuoteItem } from '../services/pricing.response';

export const createOrderSchema = z
  .object({
    auditId: z.string().uuid(),
    contact: z
      .object({
        email: z.string().trim().toLowerCase().max(254).email(),
        fullName: z.string().trim().min(2).max(120),
      })
      .strict(),
    address: z
      .object({
        street: z.string().trim().min(3).max(200),
        city: z.string().trim().min(2).max(100),
        postalCode: z
          .string()
          .trim()
          .min(3)
          .max(12)
          .regex(/^[A-Za-z0-9 -]+$/),
        region: z
          .string()
          .trim()
          .regex(/^[A-Za-z]{2}$/)
          .transform((v) => v.toUpperCase()),
      })
      .strict(),
  })
  .strict();

export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export interface OrderCoupon {
  code: string;
  discountAmount: number;
}

/** The public shape of an order; also what the immutable snapshot stores (plus internal ids). */
export interface OrderBody {
  orderNumber: string;
  status: 'CONFIRMED';
  payment: 'DEMO_NOT_CHARGED';
  items: QuoteItem[];
  subtotal: number;
  totalDiscount: number;
  couponDiscount: number;
  savings: number;
  shipping: ShippingOption;
  grandTotal: number;
  currency: string;
  contact: CreateOrderRequest['contact'];
  address: CreateOrderRequest['address'];
  coupon?: OrderCoupon;
  createdAt: Date;
}
