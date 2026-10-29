import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { cart, seedPricingData } from './helpers/fixtures';
import { PricingAudit } from '../src/models/pricingAudit.model';
import { computeChecksum } from '../src/services/audit.checksum';

let app: Express;
let alice: TestUser;
let bob: TestUser;
let admin: TestUser;
let aliceAuditId: string;
const CALC = '/api/v1/pricing/calculate';
const audit = (id: string): string => `/api/v1/pricing/audit/${id}`;

beforeAll(async () => {
  await openDatabase('test_ownership');
  await seedPricingData();
  app = buildApp();
  alice = await createTestUser(app, 'customer', 'alice');
  bob = await createTestUser(app, 'customer', 'bob');
  admin = await createTestUser(app, 'admin', 'root');
});
afterAll(closeDatabase);

describe('calculate owner rule [DoD-8]', () => {
  it('stamps the token subject and keeps the checksum valid', async () => {
    const res = await request(app)
      .post(CALC)
      .set(...bearer(alice.token))
      .send(cart);
    expect(res.status).toBe(200);
    aliceAuditId = res.body.data.auditId;
    const doc = await PricingAudit.findOne({ auditId: aliceAuditId }).lean();
    if (!doc) throw new Error('audit not stored');
    expect(doc.context.userId).toBe(alice.id);
    expect(doc.checksum).toBe(
      computeChecksum({
        auditId: doc.auditId,
        cartId: doc.cartId,
        context: doc.context,
        items: doc.items,
        result: doc.result,
      }),
    );
  });

  it('returns 403 USER_MISMATCH for another userId and writes no audit', async () => {
    const before = await PricingAudit.countDocuments({});
    const res = await request(app)
      .post(CALC)
      .set(...bearer(alice.token))
      .send({ ...cart, context: { ...cart.context, userId: bob.id } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('USER_MISMATCH');
    expect(await PricingAudit.countDocuments({})).toBe(before);
  });

  it('lets admins price on behalf of a user and defaults to their own subject', async () => {
    const onBehalf = await request(app)
      .post(CALC)
      .set(...bearer(admin.token))
      .send({ ...cart, context: { ...cart.context, userId: bob.id } });
    const own = await request(app)
      .post(CALC)
      .set(...bearer(admin.token))
      .send(cart);
    const a = await PricingAudit.findOne({ auditId: onBehalf.body.data.auditId }).lean();
    const b = await PricingAudit.findOne({ auditId: own.body.data.auditId }).lean();
    expect(a?.context.userId).toBe(bob.id);
    expect(b?.context.userId).toBe(admin.id);
  });
});

describe('audit read ownership [DoD-9]', () => {
  it('lets the owner and admins read, hides it from other customers', async () => {
    const owner = await request(app)
      .get(audit(aliceAuditId))
      .set(...bearer(alice.token));
    const adminRead = await request(app)
      .get(audit(aliceAuditId))
      .set(...bearer(admin.token));
    const other = await request(app)
      .get(audit(aliceAuditId))
      .set(...bearer(bob.token));
    const missing = await request(app)
      .get(audit('00000000-0000-4000-8000-000000000000'))
      .set(...bearer(bob.token));
    expect(owner.status).toBe(200);
    expect(adminRead.status).toBe(200);
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe('AUDIT_NOT_FOUND');
    expect(missing.status).toBe(404);
    expect(other.body.error.message.replace(aliceAuditId, 'ID')).toBe(
      missing.body.error.message.replace('00000000-0000-4000-8000-000000000000', 'ID'),
    );
  });
});
