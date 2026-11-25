// Maps API errors to distinct, readable messages. Status drives the fallback.
const BY_CODE = {
  UNKNOWN_SKU: 'Some products are no longer available. Reload the catalog and update your cart.',
  MIN_SUBTOTAL_NOT_MET: 'The cart total is below the minimum required for this coupon.',
  COUPON_LIMIT_REACHED: 'You have reached the limit of active uses for this coupon.',
  COUPON_ALREADY_APPLIED: 'This coupon is already applied to this cart.',
  COUPON_EXHAUSTED: 'This coupon has no uses left.',
  COUPON_UNAVAILABLE: 'This coupon is inactive or expired.',
  COUPON_NOT_FOUND: 'Coupon not found for your account.',
  CURRENCY_MISMATCH: 'A product currency does not match the cart currency.',
  PRODUCT_EXISTS: 'A product with this SKU already exists.',
  PRODUCT_NOT_FOUND: 'Product not found.',
};

function details(err) {
  const skus = err.details && err.details.skus;
  return Array.isArray(skus) ? ` (${skus.join(', ')})` : '';
}

export function describeError(err) {
  if (!err || typeof err.status !== 'number') return 'Unexpected error.';
  if (err.status === 0) return 'Cannot reach the server. Check your connection and retry.';
  if (err.status === 401) return 'Your session expired or is invalid. Please log in again.';
  if (err.status === 429) return err.message;
  const known = BY_CODE[err.code];
  if (known) return `${known}${details(err)}`;
  const label = err.status === 409 ? 'Conflict' : err.status === 422 ? 'Cannot process' : 'Error';
  let text = `${label} (${err.code}): ${err.message}`;
  if (err.details !== undefined && err.details !== null) {
    try {
      text += ` ${JSON.stringify(err.details)}`;
    } catch {
      /* ignore unserializable details */
    }
  }
  return text;
}
