import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { seedPricingData } from './helpers/fixtures';
import { calculate } from './helpers/pricing';
import { PricingAudit } from '../src/models/pricingAudit.model';
import { Coupon } from '../src/models/coupon.model';
import { Product } from '../src/models/product.model';
import { computeChecksum } from '../src/services/audit.checksum';

let app: Express;
let admin: TestUser;
let alice: TestUser;
const A = '/api/v1/admin/products';

const asAdmin = (method: 'get' | 'post' | 'patch', url: string): request.Test => {
  const agent = request(app);
  const req =
    method === 'get' ? agent.get(url) : method === 'post' ? agent.post(url) : agent.patch(url);
  return req.set(...bearer(admin.token));
};

beforeAll(async () => {
  await openDatabase('test_catalog');
  await seedPricingData();
  app = buildApp();
  admin = await createTestUser(app, 'admin', 'root');
  alice = await createTestUser(app, 'customer', 'alice');
});
afterAll(closeDatabase);

describe('GET /catalog', () => {
  it('401 without a token', async () => {
    expect((await request(app).get('/api/v1/catalog')).status).toBe(401);
  });

  it('lists active products only, sorted by sku, without internal fields', async () => {
    await Product.create({
      sku: 'SKU-OLD',
      name: 'Old',
      category: 'c',
      unitPrice: 1,
      isActive: false,
    });
    const res = await request(app)
      .get('/api/v1/catalog')
      .set(...bearer(alice.token));
    expect(res.status).toBe(200);
    const skus = res.body.data.map((p: { sku: string }) => p.sku);
    expect(skus).toHaveLength(6);
    expect(skus).toEqual([...skus].sort());
    expect(skus).not.toContain('SKU-OLD');
    expect(res.body.data[0]).toEqual({
      sku: 'SKU-CABLE',
      name: 'USB-C cable',
      category: 'accessories',
      unitPrice: 1000,
      currency: 'USD',
    });
  });
});

describe('admin products', () => {
  const body = { sku: 'sku-new', name: 'New thing', category: 'misc', unitPrice: 999 };

  it('customer gets 403', async () => {
    const res = await request(app)
      .get(A)
      .set(...bearer(alice.token));
    expect(res.status).toBe(403);
  });

  it('creates with an uppercased sku and USD default, 409 on duplicate', async () => {
    const created = await asAdmin('post', A).send(body);
    expect(created.status).toBe(201);
    expect(created.body.data).toEqual({
      sku: 'SKU-NEW',
      name: 'New thing',
      category: 'misc',
      unitPrice: 999,
      currency: 'USD',
      isActive: true,
    });
    const dup = await asAdmin('post', A).send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PRODUCT_EXISTS');
  });

  it('validates input strictly', async () => {
    expect((await asAdmin('post', A).send({ ...body, sku: 'X', unitPrice: 1.5 })).status).toBe(400);
    expect((await asAdmin('post', A).send({ ...body, sku: 'X', extra: 1 })).status).toBe(400);
  });

  it('patches fields, lists inactive products, 404 for a missing sku, 400 for empty patch', async () => {
    const patched = await asAdmin('patch', `${A}/sku-new`).send({
      unitPrice: 1200,
      isActive: false,
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data).toMatchObject({ unitPrice: 1200, isActive: false });
    const list = await asAdmin('get', A);
    expect(list.body.data.some((p: { sku: string }) => p.sku === 'SKU-NEW')).toBe(true);
    expect((await asAdmin('patch', `${A}/NOPE`).send({ name: 'x' })).body.error.code).toBe(
      'PRODUCT_NOT_FOUND',
    );
    expect((await asAdmin('patch', `${A}/SKU-NEW`).send({})).status).toBe(400);
    expect((await asAdmin('patch', `${A}/SKU-NEW`).send({ sku: 'Z' })).status).toBe(400);
  });
});

describe('server-resolved prices', () => {
  const item = { sku: 'SKU-MOUSE', quantity: 2 };

  it('rejects client-supplied price, name or category with 400', async () => {
    for (const extra of [{ unitPrice: 1 }, { name: 'x' }, { category: 'x' }]) {
      const res = await calculate(app, alice, 'c-strict', { items: [{ ...item, ...extra }] });
      expect(res.status).toBe(400);
    }
  });

  it('422 UNKNOWN_SKU lists unknown and inactive skus', async () => {
    const res = await calculate(app, alice, 'c-unknown', {
      items: [item, { sku: 'GHOST', quantity: 1 }, { sku: 'sku-old', quantity: 1 }],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNKNOWN_SKU');
    expect(res.body.error.details.skus.sort()).toEqual(['GHOST', 'SKU-OLD']);
  });

  it('422 CURRENCY_MISMATCH when the cart currency differs from the product', async () => {
    const res = await calculate(app, alice, 'c-cur', {
      context: { currency: 'EUR' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CURRENCY_MISMATCH');
  });

  it('prices come from the catalog; later price changes do not alter old audits', async () => {
    const first = await calculate(app, alice, 'c-price-1', { items: [item] });
    expect(first.status).toBe(200);
    expect(first.body.data.items).toEqual([
      {
        sku: 'SKU-MOUSE',
        name: 'Optical mouse',
        category: 'accessories',
        unitPrice: 1500,
        quantity: 2,
      },
    ]);
    expect(first.body.data.subtotal).toBe(3000);

    await asAdmin('patch', `${A}/SKU-MOUSE`).send({ unitPrice: 5000 });
    const second = await calculate(app, alice, 'c-price-2', { items: [item] });
    expect(second.body.data.subtotal).toBe(10000);

    const old = await asAdmin('get', `/api/v1/admin/audits/${first.body.data.auditId}`);
    expect(old.body.data.items[0].unitPrice).toBe(1500);
    expect(old.body.data.result.subtotal).toBe(3000);
    expect(old.body.data.checksumValid).toBe(true);
  });
});

describe('audit checksum backward compatibility', () => {
  it('verifies a legacy audit that has no coupon field', async () => {
    const snapshot = {
      auditId: '11111111-1111-4111-8111-111111111111',
      cartId: 'legacy',
      context: { userId: 'u1', currency: 'USD' },
      items: [{ sku: 'SKU-1', category: 'electronics', unitPrice: 2500, quantity: 2 }],
      result: {
        subtotal: 5000,
        appliedRules: [],
        skippedRules: [],
        totalDiscount: 0,
        total: 5000,
        currency: 'USD',
      },
    };
    await PricingAudit.collection.insertOne({
      ...snapshot,
      checksum: computeChecksum(snapshot),
      createdAt: new Date(),
    });
    const res = await asAdmin('get', `/api/v1/admin/audits/${snapshot.auditId}`);
    expect(res.body.data.checksumValid).toBe(true);
  });

  it('detects tampering with the coupon of a new audit', async () => {
    await Coupon.create({
      code: 'CHK',
      discountType: 'fixed',
      value: 100,
      maxUses: 2,
      remainingUses: 2,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const res = await calculate(app, alice, 'chk-1', { couponCode: 'CHK' });
    const { auditId } = res.body.data;
    const ok = await asAdmin('get', `/api/v1/admin/audits/${auditId}`);
    expect(ok.body.data.checksumValid).toBe(true);
    await PricingAudit.collection.updateOne({ auditId }, { $set: { 'coupon.discountAmount': 1 } });
    const bad = await asAdmin('get', `/api/v1/admin/audits/${auditId}`);
    expect(bad.body.data.checksumValid).toBe(false);
  });
});
