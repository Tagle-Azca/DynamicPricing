import { Harness, dig } from './harness';
import { loginAs, run } from './admin.helpers';

const A = '/api/v1/admin';

export async function runAdminScenarios(h: Harness): Promise<void> {
  const customerToken = h.token ?? '';
  const admin = await loginAs(h, 'evidence.admin@example.com', 'admin');
  const owner = await loginAs(h, 'evidence.owner@example.com', 'customer');

  await run(h, {
    name: 'Admin endpoint without token',
    method: 'GET',
    path: `${A}/campaigns`,
    token: '',
    status: 401,
    expected: '401 AUTH_REQUIRED',
    verify: (b) => dig(b, 'error', 'code') === 'AUTH_REQUIRED',
  });
  await run(h, {
    name: 'Admin endpoint as customer',
    method: 'GET',
    path: `${A}/campaigns`,
    token: customerToken,
    status: 403,
    expected: '403 FORBIDDEN',
    verify: (b) => dig(b, 'error', 'code') === 'FORBIDDEN',
  });
  await run(h, {
    name: 'Admin creates a regional campaign (Lunar New Year, region CN)',
    method: 'POST',
    path: `${A}/campaigns`,
    body: {
      code: 'CNY-EVIDENCE',
      name: 'Lunar New Year 20% off',
      type: 'percentage',
      value: 20,
      priority: 70,
      startsAt: '2020-01-01T00:00:00Z',
      endsAt: '2099-01-01T00:00:00Z',
      conditions: { regions: ['CN'] },
    },
    token: admin.token,
    status: 201,
    expected: '201 with conditions.regions ["CN"]',
    verify: (b) => dig(b, 'data', 'code') === 'CNY-EVIDENCE',
  });
  await run(h, {
    name: 'Admin creates campaign with invalid dates',
    method: 'POST',
    path: `${A}/campaigns`,
    body: {
      code: 'BAD',
      name: 'Bad',
      type: 'fixed',
      value: 100,
      startsAt: '2030-01-01T00:00:00Z',
      endsAt: '2029-01-01T00:00:00Z',
    },
    token: admin.token,
    status: 400,
    expected: '400 VALIDATION_ERROR',
    verify: (b) => dig(b, 'error', 'code') === 'VALIDATION_ERROR',
  });
  const cart = (region: string, cartId: string): unknown => ({
    cartId,
    items: [{ sku: 'SKU-9', category: 'toys', unitPrice: 10000, quantity: 1 }],
    context: { currency: 'USD', region },
  });
  await run(h, {
    name: 'Calculate in region CN: regional campaign applies',
    method: 'POST',
    path: '/api/v1/pricing/calculate',
    body: cart('CN', 'cart-cn'),
    token: customerToken,
    status: 200,
    expected: '200, CNY-EVIDENCE in appliedRules',
    verify: (b) => JSON.stringify(dig(b, 'data', 'appliedRules')).includes('CNY-EVIDENCE'),
  });
  await run(h, {
    name: 'Calculate in region MX: regional campaign skipped',
    method: 'POST',
    path: '/api/v1/pricing/calculate',
    body: cart('MX', 'cart-mx'),
    token: customerToken,
    status: 200,
    expected: '200, CNY-EVIDENCE skipped with REGION_NOT_ELIGIBLE',
    verify: (b) => JSON.stringify(dig(b, 'data', 'skippedRules')).includes('REGION_NOT_ELIGIBLE'),
  });
  await run(h, {
    name: 'Admin creates a coupon bound to one user (single use)',
    method: 'POST',
    path: `${A}/coupons`,
    body: {
      code: 'VIP-OWNER',
      discountType: 'percentage',
      value: 25,
      maxUses: 1,
      expiresAt: '2099-01-01T00:00:00Z',
      userId: owner.id,
    },
    token: admin.token,
    status: 201,
    expected: '201 with userId and remainingUses 1',
    verify: (b) => dig(b, 'data', 'userId') === owner.id,
  });
  const apply = { code: 'VIP-OWNER', cartId: 'vip-1', subtotal: 20000 };
  await run(h, {
    name: 'Another user applies the bound coupon',
    method: 'POST',
    path: '/api/v1/coupons/apply',
    body: apply,
    token: customerToken,
    status: 404,
    expected: '404 COUPON_NOT_FOUND (same as an unknown code)',
    verify: (b) => dig(b, 'error', 'code') === 'COUPON_NOT_FOUND',
  });
  await run(h, {
    name: 'Owner applies the bound coupon',
    method: 'POST',
    path: '/api/v1/coupons/apply',
    body: apply,
    token: owner.token,
    status: 200,
    expected: '200 RESERVED, remainingUses 0',
    verify: (b) => dig(b, 'data', 'remainingUses') === 0,
  });
  await run(h, {
    name: 'Owner reuses the consumed coupon on another cart',
    method: 'POST',
    path: '/api/v1/coupons/apply',
    body: { ...apply, cartId: 'vip-2' },
    token: owner.token,
    status: 409,
    expected: '409 COUPON_EXHAUSTED',
    verify: (b) => dig(b, 'error', 'code') === 'COUPON_EXHAUSTED',
  });
  const audits = await h.http('GET', `${A}/audits?limit=1`, undefined, admin.token);
  const auditId = String(dig(audits.body, 'data', '0', 'auditId'));
  await run(h, {
    name: 'Admin verifies one audit (checksum recomputed on read)',
    method: 'GET',
    path: `${A}/audits/${auditId}`,
    token: admin.token,
    status: 200,
    expected: '200, checksumValid true',
    verify: (b) => dig(b, 'data', 'checksumValid') === true,
  });
  await run(h, {
    name: 'Admin exports the audit backup (JSON)',
    method: 'GET',
    path: `${A}/audits/export?from=2020-01-01`,
    token: admin.token,
    status: 200,
    expected: '200, all rows checksumValid true',
    verify: (b) => {
      const rows = dig(b, 'data');
      return (
        Array.isArray(rows) &&
        rows.length > 0 &&
        rows.every((r) => (r as { checksumValid?: boolean }).checksumValid === true)
      );
    },
  });
}
