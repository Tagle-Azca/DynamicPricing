import { z } from 'zod';
import { cents, currencyCode, upperCode } from './admin.common.dto';

const productFields = {
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(64),
  unitPrice: cents.max(1_000_000_000),
  currency: currencyCode,
  isActive: z.boolean(),
};

export const createProductSchema = z
  .object({
    sku: upperCode,
    ...productFields,
    currency: productFields.currency.default('USD'),
    isActive: productFields.isActive.default(true),
  })
  .strict();

export const updateProductSchema = z
  .object(productFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const skuParamsSchema = z.object({ sku: upperCode });

export type CreateProduct = z.infer<typeof createProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
