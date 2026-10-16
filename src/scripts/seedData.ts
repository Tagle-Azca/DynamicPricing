import type { CampaignDoc } from '../models/campaign.model';
import type { CouponDoc } from '../models/coupon.model';

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildCampaigns(now: Date): CampaignDoc[] {
  const past = new Date(now.getTime() - 30 * DAY_MS);
  const future = new Date(now.getTime() + 365 * DAY_MS);
  const base = { startsAt: past, endsAt: future, isActive: true };
  return [
    {
      ...base,
      code: 'SUMMER10',
      name: 'Summer 10% off',
      type: 'percentage',
      value: 10,
      priority: 50,
      stackable: true,
      conditions: {},
    },
    {
      ...base,
      code: 'FIXED5',
      name: '5.00 off any cart',
      type: 'fixed',
      value: 500,
      priority: 40,
      stackable: true,
      conditions: {},
    },
    {
      ...base,
      code: 'MEGA25',
      name: 'Mega 25% off big carts',
      type: 'percentage',
      value: 25,
      priority: 100,
      stackable: false,
      conditions: { minSubtotal: 50000 },
    },
    {
      ...base,
      code: 'GOLD15',
      name: 'Gold members 15% off',
      type: 'percentage',
      value: 15,
      priority: 60,
      stackable: true,
      conditions: { customerTiers: ['gold', 'platinum'] },
    },
    {
      code: 'EXPIRED30',
      name: 'Expired 30% off',
      type: 'percentage',
      value: 30,
      priority: 90,
      stackable: true,
      startsAt: new Date(now.getTime() - 90 * DAY_MS),
      endsAt: new Date(now.getTime() - 60 * DAY_MS),
      isActive: false,
      conditions: {},
    },
  ];
}

export function buildCoupons(now: Date): CouponDoc[] {
  const future = new Date(now.getTime() + 365 * DAY_MS);
  const base = { expiresAt: future, isActive: true, minSubtotal: 0 };
  return [
    {
      ...base,
      code: 'WELCOME10',
      discountType: 'percentage',
      value: 10,
      maxUses: 1000,
      remainingUses: 1000,
    },
    { ...base, code: 'FLASH5', discountType: 'fixed', value: 500, maxUses: 5, remainingUses: 5 },
    {
      ...base,
      code: 'EXPIRED20',
      discountType: 'percentage',
      value: 20,
      maxUses: 100,
      remainingUses: 100,
      expiresAt: new Date(now.getTime() - 7 * DAY_MS),
    },
    {
      ...base,
      code: 'BIGSPEND',
      discountType: 'fixed',
      value: 5000,
      maxUses: 50,
      remainingUses: 50,
      minSubtotal: 100000,
    },
    {
      ...base,
      code: 'LASTONE',
      discountType: 'percentage',
      value: 15,
      maxUses: 1,
      remainingUses: 1,
    },
  ];
}
