import { randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongoose';
import { PricingAudit } from '../models/pricingAudit.model';
import { AppError } from '../errors/AppError';
import type { AuditSnapshot } from '../dtos/audit.dto';
import type { Principal } from '../dtos/auth.dto';
import type { ShippingOption } from '../config/shipping';
import type { AuditCoupon, CartItem, PricingContext, PricingResult } from '../dtos/pricing.dto';
import { checksumSnapshot, computeChecksum } from './audit.checksum';

export interface AuditInput {
  cartId: string;
  context: PricingContext;
  items: CartItem[];
  result: PricingResult;
  auditId?: string;
  coupon?: AuditCoupon;
  shipping?: ShippingOption;
}

export async function recordAudit(
  input: AuditInput,
  session?: ClientSession,
): Promise<{ auditId: string; createdAt: Date }> {
  const auditId = input.auditId ?? randomUUID();
  const { cartId, context, items, result, coupon, shipping } = input;
  const snapshot = checksumSnapshot({ auditId, cartId, context, items, result, coupon, shipping });
  const checksum = computeChecksum(snapshot);
  const createdAt = new Date();
  await PricingAudit.create([{ ...snapshot, checksum, createdAt }], { session });
  return { auditId, createdAt };
}

export async function getAudit(auditId: string, principal: Principal): Promise<AuditSnapshot> {
  const filter: Record<string, string> = { auditId };
  if (principal.role !== 'admin') filter['context.userId'] = principal.sub;
  const doc = await PricingAudit.findOne(filter).select('-_id').lean<AuditSnapshot>();
  if (!doc) throw new AppError(404, 'AUDIT_NOT_FOUND', `Audit ${auditId} not found`);
  return doc;
}
