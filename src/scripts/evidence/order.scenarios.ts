import { Harness, dig } from './harness';

const CALCULATE = '/api/v1/pricing/calculate';
const ORDERS = '/api/v1/orders';

const contact = { email: 'evidence.customer@example.com', fullName: 'Evidence Customer' };
const address = { street: '1 Main St', city: 'Buenos Aires', postalCode: 'C1000', region: 'AR' };

async function check(
  h: Harness,
  name: string,
  call: { method: string; path: string; body?: unknown },
  expected: string,
  pass: (status: number, body: unknown) => boolean,
): Promise<{ status: number; body: unknown }> {
  const res = await h.http(call.method, call.path, call.body);
  h.record({
    name,
    method: call.method,
    path: call.path,
    requestBody: call.body,
    status: res.status,
    responseBody: res.body,
    expected,
    pass: pass(res.status, res.body),
  });
  return res;
}

export async function runOrderScenarios(h: Harness): Promise<void> {
  const quoteBody = {
    cartId: 'cart-order-1',
    items: [
      { sku: 'SKU-KEYBOARD', quantity: 2 },
      { sku: 'SKU-CABLE', quantity: 1 },
    ],
    context: { currency: 'USD', region: 'AR' },
    delivery: 'standard',
  };
  const quote = await check(
    h,
    'Calculate with delivery (shipping options, shipping and grandTotal from the server)',
    { method: 'POST', path: CALCULATE, body: quoteBody },
    '200, standard shipping 499, grandTotal = finalTotal + 499',
    (status, body) =>
      status === 200 &&
      dig(body, 'data', 'shipping', 'amount') === 499 &&
      dig(body, 'data', 'grandTotal') === Number(dig(body, 'data', 'finalTotal')) + 499,
  );
  const auditId = String(dig(quote.body, 'data', 'auditId'));

  await check(
    h,
    'Order with a card field is rejected',
    { method: 'POST', path: ORDERS, body: { auditId, contact, address, card: { number: 'x' } } },
    '400 VALIDATION_ERROR',
    (status, body) => status === 400 && dig(body, 'error', 'code') === 'VALIDATION_ERROR',
  );
  const order = { auditId, contact, address };
  const created = await check(
    h,
    'Create a demo order (re-priced by the server, no payment taken)',
    { method: 'POST', path: ORDERS, body: order },
    '201, CONFIRMED, DEMO_NOT_CHARGED, grandTotal equals the quoted grandTotal',
    (status, body) =>
      status === 201 &&
      dig(body, 'data', 'status') === 'CONFIRMED' &&
      dig(body, 'data', 'payment') === 'DEMO_NOT_CHARGED' &&
      dig(body, 'data', 'grandTotal') === dig(quote.body, 'data', 'grandTotal'),
  );
  await check(
    h,
    'Repeat the same order request (idempotent replay)',
    { method: 'POST', path: ORDERS, body: order },
    '200, same order number',
    (status, body) =>
      status === 200 &&
      dig(body, 'data', 'orderNumber') === dig(created.body, 'data', 'orderNumber'),
  );
  const noDelivery = await h.http('POST', CALCULATE, {
    ...quoteBody,
    cartId: 'cart-order-2',
    delivery: undefined,
  });
  await check(
    h,
    'Order from a quote without delivery',
    {
      method: 'POST',
      path: ORDERS,
      body: { auditId: String(dig(noDelivery.body, 'data', 'auditId')), contact, address },
    },
    '422 DELIVERY_REQUIRED',
    (status, body) => status === 422 && dig(body, 'error', 'code') === 'DELIVERY_REQUIRED',
  );
  await check(
    h,
    'List active campaigns (safe fields only)',
    { method: 'GET', path: '/api/v1/campaigns/active' },
    '200, campaigns without priority or conditions',
    (status, body) => {
      const list = dig(body, 'data');
      return (
        status === 200 &&
        Array.isArray(list) &&
        list.length > 0 &&
        list.every((c: object) => !('priority' in c) && !('conditions' in c))
      );
    },
  );
}
