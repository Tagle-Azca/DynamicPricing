import { randomBytes } from 'node:crypto';
import { createUser } from '../../services/user.service';
import { Harness, dig } from './harness';

export async function loginAs(
  h: Harness,
  email: string,
  role: 'admin' | 'customer',
): Promise<{ token: string; id: string }> {
  const password = randomBytes(18).toString('hex');
  await createUser(email, password, role, 10);
  const res = await h.http('POST', '/api/v1/auth/login', { email, password }, '');
  return {
    token: String(dig(res.body, 'data', 'accessToken')),
    id: String(dig(res.body, 'data', 'user', 'id')),
  };
}

export interface Check {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  token: string | undefined;
  status: number;
  expected: string;
  verify?: (body: unknown) => boolean;
}

export async function run(h: Harness, c: Check): Promise<void> {
  const res = await h.http(c.method, c.path, c.body, c.token ?? '');
  h.record({
    name: c.name,
    method: c.method,
    path: c.path,
    requestBody: c.body,
    status: res.status,
    responseBody: res.body,
    expected: c.expected,
    pass: res.status === c.status && (c.verify ? c.verify(res.body) : true),
  });
}

/** Calculates a one-keyboard cart for the given token and returns the audit id. */
export async function auditFor(h: Harness, token: string, cartId: string): Promise<string> {
  const body = {
    cartId,
    items: [{ sku: 'SKU-KEYBOARD', quantity: 4 }],
    context: { currency: 'USD' },
  };
  const res = await h.http('POST', '/api/v1/pricing/calculate', body, token);
  return String(dig(res.body, 'data', 'auditId'));
}
