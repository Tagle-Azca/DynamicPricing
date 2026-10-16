import { randomUUID } from 'node:crypto';
import { PricingAudit } from '../models/pricingAudit.model';
import { AppError } from '../errors/AppError';
import type { AuditSnapshot } from '../dtos/audit.dto';
import type { CalculateRequest, PricingResult } from '../dtos/pricing.dto';
import { computeChecksum } from './audit.checksum';

export async function recordAudit(
  request: CalculateRequest,
  result: PricingResult,
): Promise<{ auditId: string; createdAt: Date }> {
  const auditId = randomUUID();
  const snapshot = {
    auditId,
    cartId: request.cartId,
    context: request.context,
    items: request.items,
    result,
  };
  const checksum = computeChecksum(snapshot);
  const createdAt = new Date();
  await PricingAudit.create({ ...snapshot, checksum, createdAt });
  return { auditId, createdAt };
}

export async function getAudit(auditId: string): Promise<AuditSnapshot> {
  const doc = await PricingAudit.findOne({ auditId }).select('-_id').lean<AuditSnapshot>();
  if (!doc) throw new AppError(404, 'AUDIT_NOT_FOUND', `Audit ${auditId} not found`);
  return doc;
}
