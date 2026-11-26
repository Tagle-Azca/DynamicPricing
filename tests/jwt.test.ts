import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { buildApp, closeDatabase, openDatabase, testConfig } from './helpers/app';
import { createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';

let app: Express;
let user: TestUser;
const ME = '/api/v1/auth/me';
const secret = testConfig().jwtSecret;
const claims = { iss: 'dynamic-pricing-api', aud: 'dynamic-pricing-clients' };

function b64(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function callMe(authorization?: string): Promise<request.Response> {
  const req = request(app).get(ME);
  return authorization ? req.set('Authorization', authorization) : req;
}

beforeAll(async () => {
  await openDatabase('test_jwt');
  app = buildApp();
  user = await createTestUser(app, 'customer', 'jwt');
});
afterAll(closeDatabase);

describe('missing credentials [DoD-4]', () => {
  it('returns 401 AUTH_REQUIRED with WWW-Authenticate', async () => {
    for (const header of [undefined, `Basic ${user.token}`, `bearer ${user.token}`, 'Bearer']) {
      const res = await callMe(header);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED');
      expect(res.headers['www-authenticate']).toBe('Bearer');
    }
  });
});

describe('token validation [DoD-5]', () => {
  it('accepts a valid token', async () => {
    const res = await callMe(`Bearer ${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sub: user.id, role: 'customer', tier: 'standard' });
  });

  it('returns 401 TOKEN_EXPIRED for an expired token', async () => {
    const token = jwt.sign({ role: 'customer' }, secret, {
      algorithm: 'HS256',
      subject: user.id,
      expiresIn: -10,
      issuer: claims.iss,
      audience: claims.aud,
    });
    const res = await callMe(`Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  const sign = (key: string, extra: jwt.SignOptions = {}, payload: object = { role: 'customer' }) =>
    jwt.sign(payload, key, {
      algorithm: 'HS256',
      subject: user.id,
      expiresIn: 600,
      issuer: claims.iss,
      audience: claims.aud,
      ...extra,
    });

  it.each([
    ['different secret', () => sign('x'.repeat(40))],
    [
      'alg none',
      () =>
        `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id, role: 'admin', ...claims, exp: 9999999999 })}.`,
    ],
    ['HS512', () => sign(secret, { algorithm: 'HS512' })],
    ['wrong issuer', () => sign(secret, { issuer: 'evil' })],
    ['wrong audience', () => sign(secret, { audience: 'evil' })],
    ['unknown role', () => sign(secret, {}, { role: 'superuser' })],
    [
      'edited role without re-signing',
      () => {
        const [h, , s] = sign(secret).split('.');
        const payload = b64({ sub: user.id, role: 'admin', ...claims, exp: 9999999999 });
        return `${h}.${payload}.${s}`;
      },
    ],
    ['garbage', () => 'not.a.jwt'],
  ])('returns 401 TOKEN_INVALID for %s', async (_name, make) => {
    const res = await callMe(`Bearer ${make()}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });
});
