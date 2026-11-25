import { Schema, model } from 'mongoose';

export const RESERVATION_STATUSES = ['RESERVED', 'RELEASED', 'CONSUMED'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface CouponReservationDoc {
  couponCode: string;
  userId: string;
  cartId: string;
  auditId: string;
  discount: number;
  subtotal: number;
  status: ReservationStatus;
  expiresAt: Date;
  releasedAt?: Date;
  consumedAt?: Date;
  createdAt: Date;
}

const reservationSchema = new Schema<CouponReservationDoc>(
  {
    couponCode: { type: String, required: true },
    userId: { type: String, required: true },
    cartId: { type: String, required: true },
    auditId: { type: String, required: true },
    discount: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    status: { type: String, enum: RESERVATION_STATUSES, required: true, default: 'RESERVED' },
    expiresAt: { type: Date, required: true },
    releasedAt: { type: Date },
    consumedAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    // Built by prepareReservationIndexes() at startup, after any legacy index is repaired.
    autoIndex: false,
  },
);

// Only active reservations are unique per cart, so a released cart can reserve again.
reservationSchema.index(
  { couponCode: 1, cartId: 1 },
  { unique: true, partialFilterExpression: { status: 'RESERVED' } },
);
// One active coupon per cart (for its owner) and per audit, whatever the code.
reservationSchema.index(
  { cartId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: 'RESERVED' } },
);
reservationSchema.index(
  { auditId: 1 },
  { unique: true, partialFilterExpression: { status: 'RESERVED' } },
);
reservationSchema.index({ couponCode: 1, userId: 1, status: 1 });
reservationSchema.index({ status: 1, expiresAt: 1 });

export const CouponReservation = model<CouponReservationDoc>(
  'CouponReservation',
  reservationSchema,
);
