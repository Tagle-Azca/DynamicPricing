import { Harness } from './harness';
import { PricingAudit } from '../../models/pricingAudit.model';
import { computeChecksum } from '../../services/audit.checksum';

async function rejects(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return 'NOT_REJECTED';
  } catch (err) {
    return (err as { code?: string }).code ?? 'ERROR';
  }
}

export async function runImmutabilityScenario(h: Harness): Promise<void> {
  const doc = await PricingAudit.findOne({}).lean();
  if (!doc) throw new Error('No audit available for immutability scenario');
  const before = JSON.stringify(doc);

  const outcomes = {
    updateOne: await rejects(() =>
      PricingAudit.updateOne({ auditId: doc.auditId }, { cartId: 'x' }),
    ),
    deleteOne: await rejects(() => PricingAudit.deleteOne({ auditId: doc.auditId })),
    findOneAndUpdate: await rejects(() =>
      PricingAudit.findOneAndUpdate({ auditId: doc.auditId }, { checksum: 'x' }),
    ),
    deleteMany: await rejects(() => PricingAudit.deleteMany({})),
  };
  const after = await PricingAudit.findOne({ auditId: doc.auditId }).lean();
  const unchanged = JSON.stringify(after) === before;
  const checksumOk =
    !!after &&
    after.checksum ===
      computeChecksum({
        auditId: after.auditId,
        cartId: after.cartId,
        context: after.context,
        items: after.items,
        result: after.result,
      });

  h.record({
    name: 'Immutability: direct update/delete attempts rejected, document unchanged',
    method: 'MODEL',
    path: 'PricingAudit.updateOne / deleteOne / findOneAndUpdate / deleteMany',
    responseBody: { outcomes, documentUnchanged: unchanged, checksumStillValid: checksumOk },
    expected: 'all rejected with AUDIT_IMMUTABLE; document unchanged',
    pass: Object.values(outcomes).every((o) => o === 'AUDIT_IMMUTABLE') && unchanged && checksumOk,
  });
}
