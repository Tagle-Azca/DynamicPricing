import { loadEnv } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { initModels } from '../models';
import { Campaign } from '../models/campaign.model';
import { Coupon } from '../models/coupon.model';
import { CouponReservation } from '../models/couponReservation.model';
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

async function main(): Promise<void> {
  const env = loadEnv();
  await connectDatabase(env.MONGODB_URI);
  await seedDatabase();
  console.log('Seed complete: campaigns, coupons and reservations reset (audits untouched)');
  await disconnectDatabase();
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}
