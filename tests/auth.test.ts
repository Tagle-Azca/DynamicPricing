import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { randomPassword } from './helpers/users';
import { User } from '../src/models/user.model';
import { loadEnv } from '../src/config/env';

let app: Express;
const password = randomPassword();

beforeAll(async () => {
  await openDatabase('test_auth');
  app = buildApp();
});
afterAll(closeDatabase);

describe('register [DoD-1, DoD-2]', () => {
  it('creates a customer and stores a bcrypt hash only', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: '  Alice@Example.com ', password });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: expect.any(String),
      email: 'alice@example.com',
      role: 'customer',
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const stored = await User.findOne({ email: 'alice@example.com' }).select('+passwordHash');
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(stored?.passwordHash).not.toContain(password);
  });

  it('rejects a role field and creates no user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'mallory@example.com', password, role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await User.countDocuments({ email: 'mallory@example.com' })).toBe(0);
  });

  it('returns 409 EMAIL_TAKEN for a duplicate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'alice@example.com', password });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects short passwords and passwords over 72 bytes', async () => {
    const short = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'short@example.com', password: 'elevenchars' });
    const long = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'long@example.com', password: 'a'.repeat(73) });
    const multibyte = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'bytes@example.com', password: 'é'.repeat(37) });
    expect([short.status, long.status, multibyte.status]).toEqual([400, 400, 400]);
  });
});

describe('login [DoD-3]', () => {
  it('issues an HS256 token with the expected claims', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    const decoded = jwt.decode(res.body.data.accessToken, { complete: true });
    expect(decoded?.header.alg).toBe('HS256');
    expect(decoded?.payload).toMatchObject({
      sub: res.body.data.user.id,
      role: 'customer',
      iss: 'dynamic-pricing-api',
      aud: 'dynamic-pricing-clients',
    });
    expect(decoded?.payload).toHaveProperty('iat');
    expect(decoded?.payload).toHaveProperty('exp');
  });

  it('returns identical 401 bodies for wrong password and unknown email', async () => {
    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password-123' });
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password-123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.body).toEqual(wrong.body);
  });
});

describe('env [DoD-6]', () => {
  const base = { MONGODB_URI: 'mongodb://localhost/x', JWT_SECRET: 'a'.repeat(32) };

  it('requires a JWT_SECRET of at least 32 characters', () => {
    expect(() => loadEnv({ MONGODB_URI: base.MONGODB_URI })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    expect(loadEnv(base).JWT_SECRET).toHaveLength(32);
  });

  it('rejects wildcard or malformed CORS origins and accepts a list', () => {
    expect(() => loadEnv({ ...base, CORS_ORIGINS: '*' })).toThrow(/CORS_ORIGINS/);
    expect(() => loadEnv({ ...base, CORS_ORIGINS: 'http://a.test/path' })).toThrow(/CORS/);
    expect(
      loadEnv({ ...base, CORS_ORIGINS: 'http://a.test, https://b.test:8443' }).CORS_ORIGINS,
    ).toEqual(['http://a.test', 'https://b.test:8443']);
  });
});
