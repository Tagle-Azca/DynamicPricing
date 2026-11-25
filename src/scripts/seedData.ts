import type { CampaignDoc } from '../models/campaign.model';
import type { CouponDoc } from '../models/coupon.model';
import type { ProductDoc } from '../models/product.model';

const DAY_MS = 24 * 60 * 60 * 1000;

export const CATALOG: ProductDoc[] = [
  { sku: 'SKU-LAPTOP', name: 'Laptop 14"', category: 'electronics', unitPrice: 120000 },
  { sku: 'SKU-PHONE', name: 'Smartphone', category: 'electronics', unitPrice: 80000 },
  { sku: 'SKU-HEADPHONES', name: 'Wireless headphones', category: 'audio', unitPrice: 15000 },
  { sku: 'SKU-KEYBOARD', name: 'Mechanical keyboard', category: 'accessories', unitPrice: 2500 },
  { sku: 'SKU-MOUSE', name: 'Optical mouse', category: 'accessories', unitPrice: 1500 },
  { sku: 'SKU-CABLE', name: 'USB-C cable', category: 'accessories', unitPrice: 1000 },
  { sku: 'SKU-MONITOR', name: 'Ultrawide monitor 34"', category: 'electronics', unitPrice: 45000 },
  { sku: 'SKU-TABLET', name: 'Tablet 11"', category: 'electronics', unitPrice: 35000 },
  { sku: 'SKU-WATCH', name: 'Smartwatch', category: 'electronics', unitPrice: 20000 },
  { sku: 'SKU-SPEAKER', name: 'Bluetooth speaker', category: 'audio', unitPrice: 6000 },
  { sku: 'SKU-WEBCAM', name: 'HD webcam', category: 'accessories', unitPrice: 4500 },
  { sku: 'SKU-CHARGER', name: 'Fast charger 65W', category: 'accessories', unitPrice: 3500 },
].map((p) => ({ ...p, currency: 'USD', isActive: true }));

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
      ...base,
      code: 'CNY15',
      name: 'Lunar New Year 15% off (CN, HK, SG)',
      type: 'percentage',
      value: 15,
      priority: 45,
      stackable: true,
      conditions: { regions: ['CN', 'HK', 'SG'] },
    },
    {
      ...base,
      code: 'SOUTHSUMMER12',
      name: 'Southern hemisphere summer 12% off (AU, AR, CL)',
      type: 'percentage',
      value: 12,
      priority: 44,
      stackable: true,
      conditions: { regions: ['AU', 'AR', 'CL'] },
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
  const base = {
    expiresAt: future,
    isActive: true,
    minSubtotal: 0,
    perUserLimit: 1,
    currency: 'USD',
  };
  return [
    {
      ...base,
      code: 'WELCOME10',
      discountType: 'percentage',
      value: 10,
      maxUses: 1000,
      remainingUses: 1000,
    },
    {
      ...base,
      code: 'FLASH5',
      discountType: 'fixed',
      value: 500,
      maxUses: 5,
      remainingUses: 5,
      perUserLimit: 5,
    },
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
