import { Product } from '../models/product.model';
import { AppError } from '../errors/AppError';
import type { CreateProduct, UpdateProduct } from '../dtos/adminProduct.dto';
import { resolveImageUrl } from './imageUrl';

const FIELDS = 'sku name category unitPrice currency isActive imageUrl -_id';

export async function listProducts(): Promise<unknown[]> {
  return Product.find({}).select(FIELDS).sort({ sku: 1 }).lean();
}

export async function createProduct(input: CreateProduct): Promise<unknown> {
  const { imageUrl: rawImage, ...rest } = input;
  const imageUrl = resolveImageUrl(rawImage);
  if (await Product.exists({ sku: { $eq: input.sku } })) {
    throw new AppError(409, 'PRODUCT_EXISTS', `Product ${input.sku} already exists`);
  }
  try {
    await Product.create({ ...rest, ...(imageUrl ? { imageUrl } : {}) });
  } catch (err) {
    if ((err as { code?: unknown }).code === 11000) {
      throw new AppError(409, 'PRODUCT_EXISTS', `Product ${input.sku} already exists`);
    }
    throw err;
  }
  return Product.findOne({ sku: { $eq: input.sku } })
    .select(FIELDS)
    .lean();
}

export async function updateProduct(sku: string, patch: UpdateProduct): Promise<unknown> {
  const imageUrl = resolveImageUrl(patch.imageUrl);
  // Allowlist: only these fields can ever reach the update document.
  const fields = {
    name: patch.name,
    category: patch.category,
    unitPrice: patch.unitPrice,
    currency: patch.currency,
    isActive: patch.isActive,
  };
  const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  const update = {
    $set: { ...set, ...(imageUrl ? { imageUrl } : {}) },
    ...(imageUrl === null ? { $unset: { imageUrl: 1 as const } } : {}),
  };
  const updated = await Product.findOneAndUpdate({ sku: { $eq: sku } }, update, {
    returnDocument: 'after',
  })
    .select(FIELDS)
    .lean();
  if (!updated) throw new AppError(404, 'PRODUCT_NOT_FOUND', `Product ${sku} not found`);
  return updated;
}
