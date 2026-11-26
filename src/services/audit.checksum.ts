import { createHash } from 'node:crypto';
import type { ShippingOption } from '../config/shipping';
import type { AuditCoupon, CartItem, PricingContext, PricingResult } from '../dtos/pricing.dto';

export interface ChecksumParts {
  auditId: string;
  cartId: string;
  context: PricingContext;
  items: CartItem[];
  result: PricingResult;
  coupon?: AuditCoupon;
  shipping?: ShippingOption;
}

/** Coupon and shipping join the checksummed snapshot only when present, so old audits verify. */
export function checksumSnapshot(p: ChecksumParts): Record<string, unknown> {
  const { auditId, cartId, context, items, result, coupon, shipping } = p;
  return {
    auditId,
    cartId,
    context,
    items,
    result,
    ...(coupon ? { coupon } : {}),
    ...(shipping ? { shipping } : {}),
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      if (obj[key] !== undefined) sorted[key] = canonicalize(obj[key]);
    }
    return sorted;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

// Unkeyed SHA-256: detects accidental or naive edits only, not a writer who can recompute it.
export function computeChecksum(snapshot: unknown): string {
  return createHash('sha256').update(canonicalJson(snapshot)).digest('hex');
}
