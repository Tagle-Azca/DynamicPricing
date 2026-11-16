import { Campaign } from '../../src/models/campaign.model';
import { Coupon } from '../../src/models/coupon.model';
import { buildCampaigns, buildCoupons } from '../../src/scripts/seedData';

export const cart = {
  cartId: 'cart-test-1',
  items: [{ sku: 'SKU-1', category: 'electronics', unitPrice: 2500, quantity: 2 }],
  context: { customerTier: 'standard', currency: 'USD' },
};

export async function seedPricingData(): Promise<void> {
  const now = new Date();
  await Campaign.insertMany(buildCampaigns(now));
  await Coupon.insertMany(buildCoupons(now));
}
