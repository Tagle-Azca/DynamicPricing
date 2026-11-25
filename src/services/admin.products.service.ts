import { Product } from '../models/product.model';
import { AppError } from '../errors/AppError';
import type { CreateProduct, UpdateProduct } from '../dtos/adminProduct.dto';

const FIELDS = 'sku name category unitPrice currency isActive -_id';

export async function listProducts(): Promise<unknown[]> {
  return Product.find({}).select(FIELDS).sort({ sku: 1 }).lean();
}

export async function createProduct(input: CreateProduct): Promise<unknown> {
  if (await Product.exists({ sku: input.sku })) {
    throw new AppError(409, 'PRODUCT_EXISTS', `Product ${input.sku} already exists`);
  }
  try {
    await Product.create(input);
  } catch (err) {
    if ((err as { code?: unknown }).code === 11000) {
      throw new AppError(409, 'PRODUCT_EXISTS', `Product ${input.sku} already exists`);
    }
    throw err;
  }
  return Product.findOne({ sku: input.sku }).select(FIELDS).lean();
}

export async function updateProduct(sku: string, patch: UpdateProduct): Promise<unknown> {
  const updated = await Product.findOneAndUpdate({ sku }, { $set: patch }, { new: true })
    .select(FIELDS)
    .lean();
  if (!updated) throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product ${sku} not found`);
  return updated;
}
