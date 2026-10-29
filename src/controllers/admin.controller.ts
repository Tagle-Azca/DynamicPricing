import type { Request, Response } from 'express';
import { listAudits } from '../services/audit.query.service';
import type { ListAuditsQuery } from '../dtos/admin.dto';

export async function listAuditsHandler(req: Request, res: Response): Promise<void> {
  const data = await listAudits(req.query as unknown as ListAuditsQuery);
  res.status(200).json({ data });
}
