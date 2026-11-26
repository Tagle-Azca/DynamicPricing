export const SHIPPING_METHODS = ['standard', 'express'] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

export interface ShippingOption {
  method: ShippingMethod;
  label: string;
  eta: string;
  amount: number;
}

export const SHIPPING_CURRENCY = 'USD';
/** Standard shipping is free when the total after campaigns and coupon reaches this (cents). */
export const FREE_STANDARD_THRESHOLD = 10000;

const BASE: Record<ShippingMethod, Omit<ShippingOption, 'method'>> = {
  standard: { label: 'Standard', eta: '3-5 business days', amount: 499 },
  express: { label: 'Express', eta: '1-2 business days', amount: 1299 },
};

/** Options priced for a cart whose payable total before shipping is `finalTotal`. */
export function shippingOptionsFor(finalTotal: number): ShippingOption[] {
  return SHIPPING_METHODS.map((method) => ({
    method,
    ...BASE[method],
    amount:
      method === 'standard' && finalTotal >= FREE_STANDARD_THRESHOLD ? 0 : BASE[method].amount,
  }));
}

export function selectShipping(
  options: ShippingOption[],
  method: ShippingMethod | undefined,
): ShippingOption | undefined {
  return method ? options.find((o) => o.method === method) : undefined;
}
