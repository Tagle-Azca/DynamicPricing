import mongoose from 'mongoose';
import { inject } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import type { AppConfig } from '../../src/config/appConfig';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import { initModels } from '../../src/models';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtTtlSeconds: 900,
    jwtIssuer: 'dynamic-pricing-api',
    jwtAudience: 'dynamic-pricing-clients',
    corsOrigins: [],
    rateLimitWindowMs: 60000,
    rateLimitMax: 100000,
    rateLimitAuthMax: 100000,
    rateLimitCouponMax: 100000,
    bcryptRounds: 10,
    trustProxy: false,
    ...overrides,
  };
}

export function buildApp(overrides: Partial<AppConfig> = {}): Express {
  return createApp(testConfig(overrides));
}

export async function openDatabase(name: string): Promise<void> {
  const uri = new URL(inject('mongoUri'));
  uri.pathname = `/${name}`;
  await connectDatabase(uri.toString());
  await initModels();
}

export async function closeDatabase(): Promise<void> {
  await mongoose.connection.dropDatabase();
  await disconnectDatabase();
}
