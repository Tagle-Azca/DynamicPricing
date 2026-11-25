import mongoose from 'mongoose';
import { PricingAudit } from '../models/pricingAudit.model';
import { AppError } from '../errors/AppError';
import type { AuditSnapshot } from '../dtos/audit.dto';
import type { ExportAuditsQuery, ListAuditsQuery } from '../dtos/adminAudit.dto';
import { computeChecksum } from './audit.checksum';

export async function listAudits(query: ListAuditsQuery): Promise<AuditSnapshot[]> {
  const filter: Record<string, string> = {};
  if (query.userId) filter['context.userId'] = query.userId;
  if (query.cartId) filter.cartId = query.cartId;
  return PricingAudit.find(filter)
    .select('-_id')
    .sort({ createdAt: -1 })
    .limit(query.limit)
    .lean<AuditSnapshot[]>();
}

export function isChecksumValid(a: AuditSnapshot): boolean {
  const { auditId, cartId, context, items, result, coupon } = a;
  const snapshot = { auditId, cartId, context, items, result, ...(coupon ? { coupon } : {}) };
  return computeChecksum(snapshot) === a.checksum;
}

export async function getAuditVerified(
  auditId: string,
): Promise<AuditSnapshot & { checksumValid: boolean }> {
  const doc = await PricingAudit.findOne({ auditId }).select('-_id').lean<AuditSnapshot>();
  if (!doc) throw new AppError(404, 'AUDIT_NOT_FOUND', `Audit ${auditId} not found`);
  return { ...doc, checksumValid: isChecksumValid(doc) };
}

export const EXPORT_MAX_ROWS = 10000;

export async function exportAudits(
  query: ExportAuditsQuery,
  maxRows: number = EXPORT_MAX_ROWS,
): Promise<Array<AuditSnapshot & { checksumValid: boolean }>> {
  const filter: Record<string, unknown> = {};
  if (query.from || query.to) {
    filter.createdAt = mongoose.trusted({
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    });
  }
  const docs = await PricingAudit.find(filter)
    .select('-_id')
    .sort({ createdAt: 1 })
    .limit(maxRows + 1)
    .lean<AuditSnapshot[]>();
  if (docs.length > maxRows) {
    throw new AppError(
      422,
      'EXPORT_TOO_LARGE',
      `More than ${maxRows} audits match; narrow the from/to range`,
    );
  }
  return docs.map((d) => ({ ...d, checksumValid: isChecksumValid(d) }));
}
