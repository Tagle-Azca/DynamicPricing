import { loadEnv } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { initModels } from '../models';
import { Campaign } from '../models/campaign.model';
import { Coupon } from '../models/coupon.model';
import { CouponReservation } from '../models/couponReservation.model';
import { User } from '../models/user.model';
import { createUser } from '../services/user.service';
import type { Env } from '../config/env';
import { buildCampaigns, buildCoupons } from './seedData';

export async function seedDatabase(now: Date = new Date()): Promise<void> {
  await initModels();
  await Promise.all([
    Campaign.deleteMany({}),
    Coupon.deleteMany({}),
    CouponReservation.deleteMany({}),
  ]);
  await Campaign.insertMany(buildCampaigns(now));
  await Coupon.insertMany(buildCoupons(now));
}

async function seedAdmin(env: Env): Promise<void> {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    console.log('Admin seeding skipped (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set)');
    return;
  }
  if (await User.exists({ email: env.SEED_ADMIN_EMAIL.toLowerCase() })) {
    console.log('Admin user already exists, left unchanged');
    return;
  }
  await createUser(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD, 'admin', env.BCRYPT_ROUNDS);
  console.log(`Admin user created: ${env.SEED_ADMIN_EMAIL}`);
}

async function main(): Promise<void> {
  const env = loadEnv();
  await connectDatabase(env.MONGODB_URI);
  await seedDatabase();
  await seedAdmin(env);
  console.log('Seed complete: campaigns, coupons and reservations reset (audits untouched)');
  await disconnectDatabase();
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
