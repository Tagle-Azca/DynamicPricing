import { Schema, model } from 'mongoose';

export interface ProductDoc {
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  currency: string;
  isActive: boolean;
}

const productSchema = new Schema<ProductDoc>(
  {
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, maxlength: 64 },
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'USD', uppercase: true, trim: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const Product = model<ProductDoc>('Product', productSchema);
