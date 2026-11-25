import type { Request, Response } from 'express';
import { listCatalog } from '../services/catalog.service';

export async function list(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await listCatalog() });
}
