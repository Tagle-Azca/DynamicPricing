import type { Request, Response } from 'express';
import { getAudit } from '../services/audit.service';
import { AppError } from '../errors/AppError';

export async function getById(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw new AppError(401, 'AUTH_REQUIRED', 'Authentication required');
  const data = await getAudit(String(req.params.auditId), req.auth);
  res.status(200).json({ data });
}
