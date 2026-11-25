import { Harness, dig } from './harness';
import { isChecksumValid } from '../../services/audit.query.service';
import type { AuditSnapshot } from '../../dtos/audit.dto';

const validCart = {
  cartId: 'cart-evidence-1',
  items: [
    { sku: 'SKU-KEYBOARD', quantity: 2 },
    { sku: 'SKU-CABLE', quantity: 1 },
  ],
  context: { customerTier: 'standard', currency: 'USD' },
};

const CALCULATE = '/api/v1/pricing/calculate';

async function expectError(
  h: Harness,
  name: string,
  body: unknown,
  status: number,
  code: string,
): Promise<void> {
  const res = await h.http('POST', CALCULATE, body);
  h.record({
    name,
    method: 'POST',
    path: CALCULATE,
    requestBody: body,
    status: res.status,
    responseBody: res.body,
    expected: `${status} ${code}`,
    pass: res.status === status && dig(res.body, 'error', 'code') === code,
  });
}

export async function runPricingScenarios(h: Harness): Promise<void> {
  const catalog = await h.http('GET', '/api/v1/catalog');
  const products = dig(catalog.body, 'data');
  h.record({
    name: 'Catalog lists the active products (server-side prices)',
    method: 'GET',
    path: '/api/v1/catalog',
    status: catalog.status,
    responseBody: catalog.body,
    expected: '200, six seeded products',
    pass: catalog.status === 200 && Array.isArray(products) && products.length === 6,
  });

  const calc = await h.http('POST', CALCULATE, validCart);
  const auditId = String(dig(calc.body, 'data', 'auditId'));
  const applied = dig(calc.body, 'data', 'appliedRules');
  h.record({
    name: 'Calculate pricing (prices resolved by the server, rules applied, auditId returned)',
    method: 'POST',
    path: CALCULATE,
    requestBody: validCart,
    status: calc.status,
    responseBody: calc.body,
    expected: '200, SUMMER10 + FIXED5 applied, total 4900, finalTotal 4900',
    pass:
      calc.status === 200 &&
      Array.isArray(applied) &&
      applied.length === 2 &&
      dig(calc.body, 'data', 'total') === 4900 &&
      dig(calc.body, 'data', 'finalTotal') === 4900 &&
      auditId.length === 36,
  });

  const invalid = { cartId: 'x', items: [], context: {} };
  await expectError(h, 'Calculate with invalid body', invalid, 400, 'VALIDATION_ERROR');
  const priced = { ...validCart, items: [{ sku: 'SKU-KEYBOARD', quantity: 1, unitPrice: 1 }] };
  await expectError(h, 'Calculate with a client-supplied price', priced, 400, 'VALIDATION_ERROR');
  const ghost = { ...validCart, items: [{ sku: 'SKU-GHOST', quantity: 1 }] };
  await expectError(h, 'Calculate with an unknown SKU', ghost, 422, 'UNKNOWN_SKU');

  const audit = await h.http('GET', `/api/v1/pricing/audit/${auditId}`);
  const data = dig(audit.body, 'data') as AuditSnapshot | undefined;
  h.record({
    name: 'Get audit snapshot (checksum matches recomputation)',
    method: 'GET',
    path: `/api/v1/pricing/audit/${auditId}`,
    status: audit.status,
    responseBody: audit.body,
    expected: '200, stored checksum equals sha256 of canonical snapshot',
    pass: audit.status === 200 && !!data && isChecksumValid(data),
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
