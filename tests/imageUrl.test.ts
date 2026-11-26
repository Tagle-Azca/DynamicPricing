import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { seedPricingData } from './helpers/fixtures';

let app: Express;
let admin: TestUser;
let customer: TestUser;
const CLOUD = 'democloud';
const OK = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/mouse.jpg`;
const P = '/api/v1/admin/products';

const asAdmin = (method: 'post' | 'patch' | 'get', url: string): request.Test => {
  const agent = request(app);
  const req =
    method === 'get' ? agent.get(url) : method === 'post' ? agent.post(url) : agent.patch(url);
  return req.set(...bearer(admin.token));
};
const create = (sku: string, imageUrl?: unknown): request.Test =>
  asAdmin('post', P).send({
    sku,
    name: 'P',
    category: 'c',
    unitPrice: 100,
    ...(imageUrl === undefined ? {} : { imageUrl }),
  });

beforeAll(async () => {
  await openDatabase('test_image_url');
  await seedPricingData();
  app = buildApp();
  admin = await createTestUser(app, 'admin', 'root');
  customer = await createTestUser(app, 'customer', 'alice');
});
afterAll(closeDatabase);
afterEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
});

describe('product imageUrl [DoD-1]', () => {
  it('stores, lists and exposes an allowed image in admin and catalog', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    const res = await create('IMG-1', OK);
    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toBe(OK);
    const catalog = await request(app)
      .get('/api/v1/catalog')
      .set(...bearer(customer.token));
    const item = catalog.body.data.find((p: { sku: string }) => p.sku === 'IMG-1');
    expect(item.imageUrl).toBe(OK);
    const plain = catalog.body.data.find((p: { sku: string }) => p.sku === 'SKU-MOUSE');
    expect(plain).not.toHaveProperty('imageUrl');
    const list = await asAdmin('get', P);
    expect(list.body.data.find((p: { sku: string }) => p.sku === 'IMG-1').imageUrl).toBe(OK);
  });

  it.each([
    ['http scheme', `http://res.cloudinary.com/${CLOUD}/a.jpg`],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:image/png;base64,AAAA'],
    ['userinfo', `https://res.cloudinary.com@evil.com/${CLOUD}/a.jpg`],
    ['userinfo before host', `https://evil.com@res.cloudinary.com/${CLOUD}/a.jpg`],
    ['credentials', `https://user:pw@res.cloudinary.com/${CLOUD}/a.jpg`],
    ['suffix lookalike', `https://res.cloudinary.com.evil.com/${CLOUD}/a.jpg`],
    ['prefix lookalike', `https://evilres.cloudinary.com/${CLOUD}/a.jpg`],
    ['subdomain', `https://x.res.cloudinary.com/${CLOUD}/a.jpg`],
    ['trailing dot host', `https://res.cloudinary.com./${CLOUD}/a.jpg`],
    ['unicode lookalike', `https://res.cloudinary.com․evil.com/${CLOUD}/a.jpg`],
    ['explicit port', `https://res.cloudinary.com:8443/${CLOUD}/a.jpg`],
    ['image fetch type', `https://res.cloudinary.com/${CLOUD}/image/fetch/https://evil.com/a.jpg`],
    ['video type', `https://res.cloudinary.com/${CLOUD}/video/upload/a.mp4`],
    ['raw type', `https://res.cloudinary.com/${CLOUD}/raw/upload/a.bin`],
    ['private type', `https://res.cloudinary.com/${CLOUD}/image/private/a.jpg`],
    ['no delivery type', `https://res.cloudinary.com/${CLOUD}/a.jpg`],
    ['other cloud', 'https://res.cloudinary.com/othercloud/a.jpg'],
    ['cloud prefix only', `https://res.cloudinary.com/${CLOUD}evil/a.jpg`],
    ['cloud case', `https://res.cloudinary.com/${CLOUD.toUpperCase()}/a.jpg`],
    ['dot segments', `https://res.cloudinary.com/${CLOUD}/../othercloud/a.jpg`],
    ['encoded dot segments', `https://res.cloudinary.com/${CLOUD}/%2e%2e/othercloud/a.jpg`],
    ['encoded slash', `https://res.cloudinary.com/${CLOUD}%2fx/a.jpg`],
    ['backslash host', `https://res.cloudinary.com\\@evil.com/${CLOUD}/a.jpg`],
    ['whitespace', `https://res.cloudinary.com/${CLOUD}/a b.jpg`],
    ['newline', `https://res.cloudinary.com/${CLOUD}/a\n.jpg`],
    ['relative', `/${CLOUD}/a.jpg`],
    ['too long', `https://res.cloudinary.com/${CLOUD}/${'a'.repeat(500)}.jpg`],
  ])('422 IMAGE_URL_NOT_ALLOWED for %s', async (_name, url) => {
    const res = await create('IMG-BAD', url);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IMAGE_URL_NOT_ALLOWED');
  });

  it('fails closed when CLOUDINARY_CLOUD_NAME is unset or malformed', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    expect((await create('IMG-2', OK)).body.error.code).toBe('IMAGE_URL_NOT_ALLOWED');
    process.env.CLOUDINARY_CLOUD_NAME = 'a/b';
    expect((await create('IMG-2', 'https://res.cloudinary.com/a/b/x.jpg')).status).toBe(422);
  });

  it('PATCH sets, rejects and clears with empty string or null', async () => {
    await create('IMG-3');
    const set = await asAdmin('patch', `${P}/IMG-3`).send({ imageUrl: OK });
    expect(set.body.data.imageUrl).toBe(OK);
    const bad = await asAdmin('patch', `${P}/IMG-3`).send({ imageUrl: 'https://evil.com/x.jpg' });
    expect(bad.status).toBe(422);
    const cleared = await asAdmin('patch', `${P}/IMG-3`).send({ imageUrl: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.data).not.toHaveProperty('imageUrl');
    await asAdmin('patch', `${P}/IMG-3`).send({ imageUrl: OK });
    const nulled = await asAdmin('patch', `${P}/IMG-3`).send({ imageUrl: null });
    expect(nulled.body.data).not.toHaveProperty('imageUrl');
  });

  it('scopes img-src to our Cloudinary cloud only', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = CLOUD;
    const res = await request(buildApp()).get('/health');
    const csp = String(res.headers['content-security-policy']);
    expect(csp).toContain(`img-src 'self' data: https://res.cloudinary.com/${CLOUD}/;`);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("font-src 'self' https: data:");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/cloudinary[^;]*;.*cloudinary/);
  });

  it('allows no remote images when the cloud name is unset', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    const res = await request(buildApp()).get('/health');
    const csp = String(res.headers['content-security-policy']);
    expect(csp).toContain("img-src 'self' data:;");
    expect(csp).not.toContain('cloudinary');
  });
});
