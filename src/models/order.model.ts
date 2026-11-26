import { Schema, model } from 'mongoose';
import type { OrderBody } from '../dtos/order.dto';
import { AppError } from '../errors/AppError';

export interface OrderDoc extends OrderBody {
  auditId: string;
  userId: string;
}

const money = { type: Number, required: true, immutable: true };

const orderSchema = new Schema<OrderDoc>(
  {
    orderNumber: { type: String, required: true, unique: true, immutable: true },
    auditId: { type: String, required: true, unique: true, immutable: true },
    userId: { type: String, required: true, immutable: true, index: true },
    status: { type: String, enum: ['CONFIRMED'], required: true, immutable: true },
    payment: { type: String, enum: ['DEMO_NOT_CHARGED'], required: true, immutable: true },
    items: { type: Schema.Types.Mixed, required: true, immutable: true },
    subtotal: money,
    totalDiscount: money,
    couponDiscount: money,
    savings: money,
    shipping: { type: Schema.Types.Mixed, required: true, immutable: true },
    grandTotal: money,
    currency: { type: String, required: true, immutable: true },
    contact: { type: Schema.Types.Mixed, required: true, immutable: true },
    address: { type: Schema.Types.Mixed, required: true, immutable: true },
    coupon: { type: Schema.Types.Mixed, immutable: true },
    createdAt: { type: Date, required: true, immutable: true, default: () => new Date() },
  },
  { collection: 'orders', versionKey: false, strict: 'throw', timestamps: false },
);

function rejectMutation(): never {
  throw new AppError(409, 'ORDER_IMMUTABLE', 'Orders are immutable snapshots');
}

const mutatingOps = [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'deleteOne',
  'deleteMany',
] as const;

for (const op of mutatingOps) orderSchema.pre(op, rejectMutation);
orderSchema.pre('bulkWrite', rejectMutation);
orderSchema.pre('updateOne', { document: true, query: false }, rejectMutation);
orderSchema.pre('deleteOne', { document: true, query: false }, rejectMutation);
orderSchema.pre('save', function (): void {
  if (!this.isNew) rejectMutation();
});

export const Order = model<OrderDoc>('Order', orderSchema);
