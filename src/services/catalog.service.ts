import mongoose from 'mongoose';
import { Product } from '../models/product.model';
import { AppError } from '../errors/AppError';
import type { CartItem, CartItemInput } from '../dtos/pricing.dto';

const PUBLIC_FIELDS = 'sku name category unitPrice currency imageUrl -_id';

export async function listCatalog(): Promise<unknown[]> {
  return Product.find({ isActive: true }).select(PUBLIC_FIELDS).sort({ sku: 1 }).lean();
}

/** Resolves client {sku, quantity} lines into priced items using only server-side data. */
export async function resolveItems(inputs: CartItemInput[], currency: string): Promise<CartItem[]> {
  const skus = [...new Set(inputs.map((i) => i.sku))];
  const products = await Product.find({
    sku: mongoose.trusted({ $in: skus }),
    isActive: true,
  }).lean();
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const unknown = skus.filter((sku) => !bySku.has(sku));
  if (unknown.length > 0) {
    throw new AppError(422, 'UNKNOWN_SKU', 'One or more SKUs are unknown or inactive', {
      skus: unknown,
    });
  }
  return inputs.map((input) => {
    const product = bySku.get(input.sku);
    if (!product) throw new AppError(500, 'INTERNAL_ERROR', 'Product resolution failed');
    if (product.currency !== currency) {
      throw new AppError(422, 'CURRENCY_MISMATCH', 'Product currency differs from cart currency', {
        sku: product.sku,
        productCurrency: product.currency,
        cartCurrency: currency,
      });
    }
    return {
      sku: product.sku,
      name: product.name,
      category: product.category,
      unitPrice: product.unitPrice,
      quantity: input.quantity,
    };
  });
}
