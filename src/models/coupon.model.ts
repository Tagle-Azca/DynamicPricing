import { Schema, model } from 'mongoose';

export interface CouponDoc {
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  maxUses: number;
  remainingUses: number;
  minSubtotal: number;
  expiresAt: Date;
  isActive: boolean;
}

const couponSchema = new Schema<CouponDoc>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    maxUses: { type: Number, required: true, min: 0 },
    remainingUses: { type: Number, required: true, min: 0 },
    minSubtotal: { type: Number, required: true, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const Coupon = model<CouponDoc>('Coupon', couponSchema);
