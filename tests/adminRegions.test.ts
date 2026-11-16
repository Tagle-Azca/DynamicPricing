import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { buildApp, closeDatabase, openDatabase } from './helpers/app';
import { bearer, createTestUser } from './helpers/users';
import type { TestUser } from './helpers/users';
import { cart, seedPricingData } from './helpers/fixtures';
import { Campaign } from '../src/models/campaign.model';

let app: Express;
let admin: TestUser;
let alice: TestUser;
const A = '/api/v1/admin';
const base = {
  type: 'percentage',
  value: 10,
  startsAt: '2020-01-01T00:00:00Z',
  endsAt: '2099-01-01T00:00:00Z',
};

function api(method: 'get' | 'put' | 'delete', path: string): request.Test {
  const req = request(app)[method](`${A}${path}`);
  return req.set(...bearer(admin.token));
}
async function create(code: string, extra: object): Promise<void> {
  const res = await request(app)
    .post(`${A}/campaigns`)
    .set(...bearer(admin.token))
    .send({ ...base, code, name: code, ...extra });
  expect(res.status).toBe(201);
}
async function regionsOf(code: string): Promise<string[] | undefined> {
  const doc = await Campaign.findOne({ code }).lean();
  return doc?.conditions?.regions;
}
async function appliedCodes(region: string): Promise<string[]> {
  const res = await request(app)
    .post('/api/v1/pricing/calculate')
    .set(...bearer(alice.token))
    .send({ ...cart, context: { ...cart.context, region } });
  return res.body.data.appliedRules.map((r: { code: string }) => r.code);
}

beforeAll(async () => {
  await openDatabase('test_admin_regions');
  await seedPricingData();
  app = buildApp();
  admin = await createTestUser(app, 'admin', 'root');
  alice = await createTestUser(app, 'customer', 'alice');
  await create('RG-ONE', { conditions: { regions: ['MX'] } });
  await create('RG-TWO', { conditions: { regions: ['FR', 'DE'] } });
  await create('RG-RACE', { conditions: { regions: ['IT', 'ES'] } });
  await create('RG-OFF', { isActive: false, conditions: { regions: ['JP'] } });
  await create('RG-OLD', { endsAt: '2021-01-01T00:00:00Z', conditions: { regions: ['JP'] } });
});
afterAll(closeDatabase);

describe('region admin auth and validation', () => {
  it('401 without a token, 403 for customers', async () => {
    expect((await request(app).get(`${A}/regions`)).status).toBe(401);
    const res = await request(app)
      .put(`${A}/campaigns/RG-ONE/regions/BR`)
      .set(...bearer(alice.token));
    expect(res.status).toBe(403);
  });

  it('400 on bad region, 404 on unknown campaign', async () => {
    for (const bad of ['USA', '1a']) {
      const res = await api('put', `/campaigns/RG-ONE/regions/${bad}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect((await api('delete', `/campaigns/RG-ONE/regions/${bad}`)).status).toBe(400);
    }
    const put = await api('put', '/campaigns/NOPE/regions/BR');
    expect(put.status).toBe(404);
    expect(put.body.error.code).toBe('CAMPAIGN_NOT_FOUND');
    expect((await api('delete', '/campaigns/NOPE/regions/BR')).status).toBe(404);
  });
});

describe('add and remove regions', () => {
  it('adds a region (lowercase uppercased), idempotent, pricing picks it up', async () => {
    expect(await appliedCodes('BR')).not.toContain('RG-ONE');
    const res = await api('put', '/campaigns/rg-one/regions/br');
    expect(res.status).toBe(200);
    expect(res.body.data.conditions.regions).toEqual(['MX', 'BR']);
    const again = await api('put', '/campaigns/RG-ONE/regions/BR');
    expect(again.status).toBe(200);
    expect(again.body.data.conditions.regions).toEqual(['MX', 'BR']);
    expect(await appliedCodes('BR')).toContain('RG-ONE');
  });

  it('removes a region, idempotent when absent, pricing skips it afterwards', async () => {
    const res = await api('delete', '/campaigns/RG-ONE/regions/BR');
    expect(res.status).toBe(200);
    expect(res.body.data.conditions.regions).toEqual(['MX']);
    const again = await api('delete', '/campaigns/RG-ONE/regions/BR');
    expect(again.status).toBe(200);
    expect(again.body.data.conditions.regions).toEqual(['MX']);
    expect(await appliedCodes('BR')).not.toContain('RG-ONE');
  });

  it('409 LAST_REGION when removing the only region, list unchanged', async () => {
    const res = await api('delete', '/campaigns/RG-ONE/regions/MX');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_REGION');
    expect(await regionsOf('RG-ONE')).toEqual(['MX']);
  });

  it('concurrent removes of the last two regions never leave an empty list', async () => {
    const [a, b] = await Promise.all([
      api('delete', '/campaigns/RG-RACE/regions/IT'),
      api('delete', '/campaigns/RG-RACE/regions/ES'),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await regionsOf('RG-RACE')).toHaveLength(1);
  });
});

describe('GET /regions', () => {
  it('lists regions with campaigns, activeNow flags and global campaigns', async () => {
    const res = await api('get', '/regions');
    expect(res.status).toBe(200);
    const { regions, global } = res.body.data;
    const names = regions.map((r: { region: string }) => r.region);
    expect(names).toEqual([...names].sort());
    const jp = regions.find((r: { region: string }) => r.region === 'JP');
    expect(jp.campaigns.map((c: { code: string }) => c.code)).toEqual(['RG-OFF', 'RG-OLD']);
    expect(jp.campaigns.map((c: { activeNow: boolean }) => c.activeNow)).toEqual([false, false]);
    const cn = regions.find((r: { region: string }) => r.region === 'CN');
    expect(cn.campaigns[0]).toMatchObject({ code: 'CNY15', type: 'percentage', activeNow: true });
    expect(typeof cn.campaigns[0].startsAt).toBe('string');
    const codes = global.map((c: { code: string }) => c.code);
    expect(codes).toContain('SUMMER10');
    const summer = global.find((c: { code: string }) => c.code === 'SUMMER10');
    expect(summer).toMatchObject({ isActive: true, activeNow: true });
    expect(summer.startsAt).toBeUndefined();
  });
});
