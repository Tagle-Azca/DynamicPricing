import { Schema, model } from 'mongoose';
import type { CartItem, PricingContext, PricingResult } from '../dtos/pricing.dto';
import { AppError } from '../errors/AppError';

export interface PricingAuditDoc {
  auditId: string;
  cartId: string;
  context: PricingContext;
  items: CartItem[];
  result: PricingResult;
  checksum: string;
  createdAt: Date;
}

const pricingAuditSchema = new Schema<PricingAuditDoc>(
  {
    auditId: { type: String, required: true, unique: true, immutable: true },
    cartId: { type: String, required: true, immutable: true, index: true },
    context: { type: Schema.Types.Mixed, required: true, immutable: true },
    items: { type: Schema.Types.Mixed, required: true, immutable: true },
    result: { type: Schema.Types.Mixed, required: true, immutable: true },
    checksum: { type: String, required: true, immutable: true },
    createdAt: { type: Date, required: true, immutable: true, default: () => new Date() },
  },
  {
    collection: 'pricing_audits',
    versionKey: false,
    strict: 'throw',
    timestamps: false,
  },
);

function rejectMutation(): never {
  throw new AppError(409, 'AUDIT_IMMUTABLE', 'Pricing audit snapshots are immutable');
}

const queryOps = [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'deleteOne',
  'deleteMany',
] as const;

for (const op of queryOps) {
  pricingAuditSchema.pre(op, rejectMutation);
}
pricingAuditSchema.pre('bulkWrite', rejectMutation);
pricingAuditSchema.pre('updateOne', { document: true, query: false }, rejectMutation);
pricingAuditSchema.pre('deleteOne', { document: true, query: false }, rejectMutation);
pricingAuditSchema.pre('save', function (): void {
  if (!this.isNew) rejectMutation();
});

export const PricingAudit = model<PricingAuditDoc>('PricingAudit', pricingAuditSchema);
