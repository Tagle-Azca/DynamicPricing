export function couponDiscount(
  discountType: 'percentage' | 'fixed',
  value: number,
  subtotal: number,
): number {
  const raw = discountType === 'percentage' ? Math.round((subtotal * value) / 100) : value;
  return Math.max(0, Math.min(raw, subtotal));
}
