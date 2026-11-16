import type { Request, Response } from 'express';
import { exportAudits, getAuditVerified, listAudits } from '../services/audit.query.service';
import { auditsToCsv } from '../services/audit.csv';
import {
  createCampaign,
  createCoupon,
  listCampaigns,
  listCoupons,
  updateCampaign,
  updateCoupon,
} from '../services/admin.catalog.service';
import type { ExportAuditsQuery, ListAuditsQuery } from '../dtos/adminAudit.dto';
import type { CreateCampaign, UpdateCampaign } from '../dtos/adminCampaign.dto';
import type { CreateCoupon, UpdateCoupon } from '../dtos/adminCoupon.dto';

export async function listAuditsHandler(req: Request, res: Response): Promise<void> {
  const data = await listAudits(req.query as unknown as ListAuditsQuery);
  res.status(200).json({ data });
}

export async function getAuditHandler(req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await getAuditVerified(String(req.params.auditId)) });
}

export async function exportAuditsHandler(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ExportAuditsQuery;
  const rows = await exportAudits(query);
  if (query.format === 'csv') {
    res
      .status(200)
      .type('text/csv')
      .set('Content-Disposition', 'attachment; filename="audits.csv"')
      .send(auditsToCsv(rows));
    return;
  }
  res.status(200).json({ data: rows });
}

export async function createCampaignHandler(req: Request, res: Response): Promise<void> {
  res.status(201).json({ data: await createCampaign(req.body as CreateCampaign) });
}
export async function listCampaignsHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await listCampaigns() });
}
export async function updateCampaignHandler(req: Request, res: Response): Promise<void> {
  const data = await updateCampaign(String(req.params.code), req.body as UpdateCampaign);
  res.status(200).json({ data });
}
export async function createCouponHandler(req: Request, res: Response): Promise<void> {
  res.status(201).json({ data: await createCoupon(req.body as CreateCoupon) });
}
export async function listCouponsHandler(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ data: await listCoupons() });
}
export async function updateCouponHandler(req: Request, res: Response): Promise<void> {
  const data = await updateCoupon(String(req.params.code), req.body as UpdateCoupon);
  res.status(200).json({ data });
}
