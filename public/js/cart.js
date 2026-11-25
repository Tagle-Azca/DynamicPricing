import { $, clear, h } from './dom.js';

const newCartId = () => `cart-${crypto.randomUUID()}`;

// Cart state and rendering. onChange fires after any change to items/context.
export function initCart(onChange, catalog) {
  const qty = new Map(); // sku -> quantity
  let cartId = newCartId();

  function renderCart() {
    const list = $('cart');
    clear(list);
    $('cart-id').textContent = cartId;
    $('cart-empty').hidden = qty.size > 0;
    for (const [sku, q] of qty) {
      const p = catalog.find(sku) || { name: sku };
      const id = `qty-${sku}`;
      list.append(
        h(
          'li',
          { class: 'item' },
          h('label', { class: 'grow', for: id, text: p.name }),
          h('input', {
            id,
            type: 'number',
            min: 1,
            max: 999,
            step: 1,
            value: q,
            class: 'qty',
            onInput: (e) => setQty(sku, e.target.valueAsNumber),
          }),
          h('button', {
            type: 'button',
            class: 'btn small secondary',
            'aria-label': `Remove ${p.name}`,
            onClick: () => remove(sku),
            text: 'Remove',
          }),
        ),
      );
    }
  }

  function changed() {
    onChange();
  }
  function add(sku) {
    qty.set(sku, (qty.get(sku) || 0) + 1);
    renderCart();
    changed();
  }
  function remove(sku) {
    qty.delete(sku);
    renderCart();
    changed();
  }
  function setQty(sku, value) {
    if (!Number.isInteger(value) || value < 1) return; // ignore transient invalid input
    qty.set(sku, Math.min(value, 999));
    changed();
  }

  $('tier').addEventListener('change', changed);
  $('region').addEventListener('change', changed);
  $('clear-cart').addEventListener('click', () => {
    qty.clear();
    cartId = newCartId();
    renderCart();
    changed();
  });

  renderCart();

  return {
    cartId: () => cartId,
    isEmpty: () => qty.size === 0,
    reset() {
      qty.clear();
      cartId = newCartId();
      renderCart();
    },
    add,
    payload(couponCode) {
      const items = [...qty].map(([sku, quantity]) => ({ sku, quantity }));
      const context = { customerTier: $('tier').value, currency: 'USD' };
      if ($('region').value) context.region = $('region').value;
      const body = { cartId, items, context };
      if (couponCode) body.couponCode = couponCode;
      return body;
    },
  };
}
