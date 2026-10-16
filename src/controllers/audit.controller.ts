import type { Request, Response } from 'express';
import { getAudit } from '../services/audit.service';

export async function getById(req: Request, res: Response): Promise<void> {
  const data = await getAudit(String(req.params.auditId));
  res.status(200).json({ data });
}
