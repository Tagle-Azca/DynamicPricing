import { Harness, dig } from './harness';
import { computeChecksum } from '../../services/audit.checksum';

const validCart = {
  cartId: 'cart-evidence-1',
  items: [
    { sku: 'SKU-1', name: 'Keyboard', category: 'electronics', unitPrice: 2500, quantity: 2 },
    { sku: 'SKU-2', category: 'accessories', unitPrice: 1000, quantity: 1 },
  ],
  context: { userId: 'user-1', customerTier: 'standard', currency: 'USD' },
};

export async function runPricingScenarios(h: Harness): Promise<void> {
  const calc = await h.http('POST', '/api/v1/pricing/calculate', validCart);
  const auditId = String(dig(calc.body, 'data', 'auditId'));
  const applied = dig(calc.body, 'data', 'appliedRules');
  h.record({
    name: 'Calculate pricing (rules applied, auditId returned)',
    method: 'POST',
    path: '/api/v1/pricing/calculate',
    requestBody: validCart,
    status: calc.status,
    responseBody: calc.body,
    expected: '200, SUMMER10 + FIXED5 applied, total 4900',
    pass:
      calc.status === 200 &&
      Array.isArray(applied) &&
      applied.length === 2 &&
      dig(calc.body, 'data', 'total') === 4900 &&
      auditId.length === 36,
  });

  const invalid = { cartId: 'x', items: [], context: {} };
  const bad = await h.http('POST', '/api/v1/pricing/calculate', invalid);
  h.record({
    name: 'Calculate with invalid body',
    method: 'POST',
    path: '/api/v1/pricing/calculate',
    requestBody: invalid,
    status: bad.status,
    responseBody: bad.body,
    expected: '400 VALIDATION_ERROR',
    pass: bad.status === 400 && dig(bad.body, 'error', 'code') === 'VALIDATION_ERROR',
  });

  const audit = await h.http('GET', `/api/v1/pricing/audit/${auditId}`);
  const data = dig(audit.body, 'data') as Record<string, unknown> | undefined;
  const snapshot = data && {
    auditId: data.auditId,
    cartId: data.cartId,
    context: data.context,
    items: data.items,
    result: data.result,
  };
  h.record({
    name: 'Get audit snapshot (checksum matches recomputation)',
    method: 'GET',
    path: `/api/v1/pricing/audit/${auditId}`,
    status: audit.status,
    responseBody: audit.body,
    expected: '200, stored checksum equals sha256 of canonical snapshot',
    pass: audit.status === 200 && !!snapshot && data.checksum === computeChecksum(snapshot),
  });

  const badId = await h.http('GET', '/api/v1/pricing/audit/not-a-uuid');
  h.record({
    name: 'Get audit with malformed id',
    method: 'GET',
    path: '/api/v1/pricing/audit/not-a-uuid',
    status: badId.status,
    responseBody: badId.body,
    expected: '400 VALIDATION_ERROR',
    pass: badId.status === 400 && dig(badId.body, 'error', 'code') === 'VALIDATION_ERROR',
  });

  const missingPath = '/api/v1/pricing/audit/00000000-0000-4000-8000-000000000000';
  const missing = await h.http('GET', missingPath);
  h.record({
    name: 'Get audit that does not exist',
    method: 'GET',
    path: missingPath,
    status: missing.status,
    responseBody: missing.body,
    expected: '404 AUDIT_NOT_FOUND',
    pass: missing.status === 404 && dig(missing.body, 'error', 'code') === 'AUDIT_NOT_FOUND',
  });
}

export { validCart };
