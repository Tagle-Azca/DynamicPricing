import type { Request, Response } from 'express';
import { createProduct, listProducts, updateProduct } from '../services/admin.products.service';
import type { CreateProduct, UpdateProduct } from '../dtos/adminProduct.dto';

export async function listProductsHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await listProducts() });
}
export async function createProductHandler(req: Request, res: Response): Promise<void> {
  res.status(201).json({ data: await createProduct(req.body as CreateProduct) });
}
export async function updateProductHandler(req: Request, res: Response): Promise<void> {
  const data = await updateProduct(String(req.params.sku), req.body as UpdateProduct);
  res.status(200).json({ data });
}
