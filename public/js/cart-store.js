// Cart state in memory: quantities plus the choices that go into every price quote.
const MAX_QTY = 999;
const newCartId = () => `cart-${crypto.randomUUID()}`;

export function createCart() {
  const qty = new Map(); // sku -> quantity
  const listeners = new Set();
  let cartId = newCartId();
  let region = '';
  let delivery = null;
  let couponCode = null;

  const emit = () => listeners.forEach((fn) => fn());

  function setQty(sku, value) {
    if (!Number.isInteger(value)) return;
    if (value < 1) qty.delete(sku);
    else qty.set(sku, Math.min(value, MAX_QTY));
    if (qty.size === 0) couponCode = null;
    emit();
  }

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    cartId: () => cartId,
    isEmpty: () => qty.size === 0,
    count: () => [...qty.values()].reduce((n, q) => n + q, 0),
    qtyOf: (sku) => qty.get(sku) || 0,
    skus: () => [...qty.keys()],
    add: (sku) => setQty(sku, (qty.get(sku) || 0) + 1),
    setQty,
    remove: (sku) => setQty(sku, 0),
    region: () => region,
    setRegion(value) {
      region = value;
      emit();
    },
    delivery: () => delivery,
    setDelivery(value) {
      delivery = value;
      emit();
    },
    couponCode: () => couponCode,
    setCoupon(code) {
      couponCode = code; // quiet: the caller already holds the matching quote
    },
    // A fresh cart id starts a new quote history (after an order or logout).
    reset() {
      qty.clear();
      cartId = newCartId();
      region = '';
      delivery = null;
      couponCode = null;
      emit();
    },
    payload() {
      const context = { currency: 'USD' };
      if (region) context.region = region;
      const body = {
        cartId,
        items: [...qty].map(([sku, quantity]) => ({ sku, quantity })),
        context,
      };
      if (couponCode) body.couponCode = couponCode;
      if (delivery) body.delivery = delivery;
      return body;
    },
  };
}
