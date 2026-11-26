import { Router } from 'express';
import * as h from '../controllers/adminProducts.controller';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import {
  createProductSchema,
  skuParamsSchema,
  updateProductSchema,
} from '../dtos/adminProduct.dto';

/** Mounted inside the admin router, so authenticate + requireRole('admin') already ran. */
export function createAdminProductsRouter(): Router {
  const router = Router();
  router.get('/products', asyncHandler(h.listProductsHandler));
  router.post(
    '/products',
    validate('body', createProductSchema),
    asyncHandler(h.createProductHandler),
  );
  router.patch(
    '/products/:sku',
    validate('params', skuParamsSchema),
    validate('body', updateProductSchema),
    asyncHandler(h.updateProductHandler),
  );
  return router;
}
