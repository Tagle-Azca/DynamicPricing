import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { seedPricingData } from './helpers/fixtures';
import { setTier } from './helpers/orders';
import { Campaign } from '../src/models/campaign.model';
import { User } from '../src/models/user.model';
import { setUserTier } from '../src/scripts/setTier';

let app: Express;
let alice: TestUser;
let gold: TestUser;
const URL = '/api/v1/campaigns/active';

const get = (user: TestUser): request.Test =>
  request(app)
    .get(URL)
    .set(...bearer(user.token));
const codes = (body: { data: Array<{ code: string }> }): string[] => body.data.map((c) => c.code);

beforeAll(async () => {
  await openDatabase('test_campaigns_active');
  await seedPricingData();
  app = buildApp();
  alice = await createTestUser(app, 'customer', 'alice');
  gold = await createTestUser(app, 'customer', 'gold');
  await setTier(gold, 'gold');
});
afterAll(closeDatabase);

describe('GET /campaigns/active [DoD-5]', () => {
  it('401 without a token', async () => {
    expect((await request(app).get(URL)).status).toBe(401);
  });

  it('returns only safe fields, in the data envelope, percentage first, active and in window', async () => {
    const res = await get(alice);
    expect(res.status).toBe(200);
    expect(codes(res.body)).toEqual(['MEGA25', 'CNY15', 'SOUTHSUMMER12', 'SUMMER10', 'FIXED5']);
    expect(res.body.data[0]).toEqual({
      code: 'MEGA25',
      name: 'Mega 25% off big carts',
      type: 'percentage',
      value: 25,
      minSubtotal: 50000,
      endsAt: expect.any(String),
    });
    for (const c of res.body.data) {
      for (const hidden of [
        'priority',
        'stackable',
        'isActive',
        'conditions',
        '_id',
        'createdAt',
      ]) {
        expect(c).not.toHaveProperty(hidden);
      }
    }
    expect(res.body.data.find((c: { code: string }) => c.code === 'FIXED5')).not.toHaveProperty(
      'minSubtotal',
    );
    expect(codes(res.body)).not.toContain('EXPIRED30');
  });

  it('caps the list at five', async () => {
    const res = await get(gold);
    expect(res.body.data).toHaveLength(5);
    expect(res.body).not.toHaveProperty('campaigns');
  });

  it('never cuts a percentage campaign in favour of a fixed one at the cap', async () => {
    const res = await get(gold);
    expect(codes(res.body)).toEqual(['MEGA25', 'CNY15', 'GOLD15', 'SOUTHSUMMER12', 'SUMMER10']);
    expect(codes(res.body)).not.toContain('FIXED5');
    expect(res.body.data.find((c: { code: string }) => c.code === 'MEGA25').minSubtotal).toBe(
      50000,
    );
  });

  it('filters tier-restricted campaigns by the stored tier', async () => {
    await Campaign.updateMany(
      { code: mongoose.trusted({ $in: ['SOUTHSUMMER12', 'CNY15'] }) },
      { isActive: false },
    );
    expect(codes((await get(alice)).body)).not.toContain('GOLD15');
    expect(codes((await get(gold)).body)).toContain('GOLD15');
  });
});

describe('set-tier script [DoD-2]', () => {
  it('sets a known user tier and reports an unknown email', async () => {
    expect(await setUserTier(alice.email.toUpperCase(), 'platinum')).toBe(true);
    expect((await User.findById(alice.id).lean())?.tier).toBe('platinum');
    expect(await setUserTier('nobody@example.com', 'gold')).toBe(false);
  });
});
