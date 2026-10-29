import { randomBytes } from 'node:crypto';
import { createUser } from '../../services/user.service';
import { dig } from './harness';
import type { Harness } from './harness';

/** Creates an evidence customer via the user service, logs in over HTTP, returns the token. */
export async function loginEvidenceCustomer(h: Harness): Promise<string> {
  const email = 'evidence.customer@example.com';
  const password = randomBytes(18).toString('hex');
  await createUser(email, password, 'customer', 10);
  const res = await h.http('POST', '/api/v1/auth/login', { email, password });
  const token = dig(res.body, 'data', 'accessToken');
  if (res.status !== 200 || typeof token !== 'string') {
    throw new Error(`Evidence login failed with status ${res.status}`);
  }
  return token;
}
