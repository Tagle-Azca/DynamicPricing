import { Harness, dig } from './harness';
import { loginAs, run } from './admin.helpers';

const PRODUCTS = '/api/v1/admin/products';

export async function runProductScenarios(h: Harness): Promise<void> {
  const admin = await loginAs(h, 'evidence.catalog.admin@example.com', 'admin');
  const customerToken = h.token ?? '';
  const product = {
    sku: 'sku-evidence',
    name: 'Evidence widget',
    category: 'misc',
    unitPrice: 777,
  };

  await run(h, {
    name: 'Customer cannot list admin products',
    method: 'GET',
    path: PRODUCTS,
    token: customerToken,
    status: 403,
    expected: '403 FORBIDDEN',
    verify: (b) => dig(b, 'error', 'code') === 'FORBIDDEN',
  });
  await run(h, {
    name: 'Admin creates a product',
    method: 'POST',
    path: PRODUCTS,
    body: product,
    token: admin.token,
    status: 201,
    expected: '201, sku uppercased, currency USD',
    verify: (b) => dig(b, 'data', 'sku') === 'SKU-EVIDENCE' && dig(b, 'data', 'currency') === 'USD',
  });
  await run(h, {
    name: 'Admin creates a duplicate product',
    method: 'POST',
    path: PRODUCTS,
    body: product,
    token: admin.token,
    status: 409,
    expected: '409 PRODUCT_EXISTS',
    verify: (b) => dig(b, 'error', 'code') === 'PRODUCT_EXISTS',
  });
  await run(h, {
    name: 'Admin changes the price of a product',
    method: 'PATCH',
    path: `${PRODUCTS}/SKU-EVIDENCE`,
    body: { unitPrice: 888 },
    token: admin.token,
    status: 200,
    expected: '200, unitPrice 888',
    verify: (b) => dig(b, 'data', 'unitPrice') === 888,
  });
  await run(h, {
    name: 'Admin patches a product that does not exist',
    method: 'PATCH',
    path: `${PRODUCTS}/SKU-NOPE`,
    body: { name: 'x' },
    token: admin.token,
    status: 404,
    expected: '404 PRODUCT_NOT_FOUND',
    verify: (b) => dig(b, 'error', 'code') === 'PRODUCT_NOT_FOUND',
  });
}
