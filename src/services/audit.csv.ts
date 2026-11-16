import type { AuditSnapshot } from '../dtos/audit.dto';

function stripControlChars(s: string): string {
  return Array.from(s)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return ch === '\t' || ch === '\n' || ch === '\r' || (code >= 0x20 && code !== 0x7f);
    })
    .join('');
}

function csvCell(v: unknown): string {
  const s = stripControlChars(v === undefined || v === null ? '' : String(v));
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function auditsToCsv(rows: Array<AuditSnapshot & { checksumValid: boolean }>): string {
  const head = [
    'createdAt',
    'auditId',
    'cartId',
    'userId',
    'region',
    'currency',
    'subtotal',
    'appliedRules',
    'totalDiscount',
    'total',
    'checksum',
    'checksumValid',
  ];
  const lines = rows.map((r) =>
    [
      new Date(r.createdAt).toISOString(),
      r.auditId,
      r.cartId,
      r.context.userId,
      r.context.region,
      r.result.currency,
      r.result.subtotal,
      r.result.appliedRules.map((x) => `${x.code}:${x.discount}`).join('|'),
      r.result.totalDiscount,
      r.result.total,
      r.checksum,
      r.checksumValid,
    ]
      .map(csvCell)
      .join(','),
  );
  return [head.join(','), ...lines].join('\n') + '\n';
}
