import request from 'supertest';
import type { Express } from 'express';
import { User } from '../../src/models/user.model';
import type { Tier } from '../../src/dtos/auth.dto';
import { bearer } from './users';
import type { TestUser } from './users';

export const CONTACT = { email: 'ada@example.com', fullName: 'Ada Lovelace' };
export const ADDRESS = {
  street: '1 Main St',
  city: 'Buenos Aires',
  postalCode: 'C1000',
  region: 'AR',
};

export async function setTier(user: TestUser, tier: Tier): Promise<void> {
  await User.updateOne({ _id: user.id }, { $set: { tier } });
}

export function orderBody(auditId: string, extra: Record<string, unknown> = {}): object {
  return { auditId, contact: CONTACT, address: ADDRESS, ...extra };
}

export function postOrder(app: Express, user: TestUser, body: unknown): request.Test {
  return request(app)
    .post('/api/v1/orders')
    .set(...bearer(user.token))
    .send(body as object);
}

/** A cart whose payable total clears the free standard shipping threshold. */
export const bigCart = { items: [{ sku: 'SKU-HEADPHONES', quantity: 1 }] };
