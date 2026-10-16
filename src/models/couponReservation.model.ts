import { Schema, model } from 'mongoose';

export interface CouponReservationDoc {
  couponCode: string;
  cartId: string;
  discount: number;
  subtotal: number;
  createdAt: Date;
}

const reservationSchema = new Schema<CouponReservationDoc>(
  {
    couponCode: { type: String, required: true },
    cartId: { type: String, required: true },
    discount: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

reservationSchema.index({ couponCode: 1, cartId: 1 }, { unique: true });

export const CouponReservation = model<CouponReservationDoc>(
  'CouponReservation',
  reservationSchema,
);
