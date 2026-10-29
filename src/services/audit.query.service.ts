import { PricingAudit } from '../models/pricingAudit.model';
import type { AuditSnapshot } from '../dtos/audit.dto';
import type { ListAuditsQuery } from '../dtos/admin.dto';

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
