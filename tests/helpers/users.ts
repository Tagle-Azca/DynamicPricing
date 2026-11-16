import { randomBytes } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import type { Role } from '../../src/dtos/auth.dto';
import { createUser } from '../../src/services/user.service';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: Role;
  token: string;
}

export function randomPassword(): string {
  return randomBytes(18).toString('hex');
}

export async function createTestUser(app: Express, role: Role, label: string): Promise<TestUser> {
  const email = `${label}-${randomBytes(4).toString('hex')}@example.com`;
  const password = randomPassword();
  const user = await createUser(email, password, role, 10);
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return { id: user.id, email, password, role, token: String(res.body.data.accessToken) };
}

export function bearer(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}
