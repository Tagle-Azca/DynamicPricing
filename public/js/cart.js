import { $, clear, h, money } from './dom.js';
import { CATALOG } from './catalog.js';

const newCartId = () => `cart-${crypto.randomUUID()}`;

// Cart state and rendering. onChange fires after any change to items/context.
export function initCart(onChange) {
  const qty = new Map(); // sku -> quantity
  let cartId = newCartId();

  function renderCatalog() {
    const list = $('catalog');
    clear(list);
    for (const p of CATALOG) {
      list.append(
        h(
          'li',
          { class: 'item' },
          h(
            'span',
            { class: 'grow' },
            h('strong', { text: p.name }),
            h('span', { class: 'muted', text: ` ${p.category}` }),
          ),
          h('span', { class: 'num', text: money(p.unitPrice) }),
          h('button', {
            type: 'button',
            class: 'btn small',
            'aria-label': `Add ${p.name} to cart`,
            onClick: () => add(p.sku),
            text: 'Add',
          }),
        ),
      );
    }
  }

  function renderCart() {
    const list = $('cart');
    clear(list);
    $('cart-id').textContent = cartId;
    $('cart-empty').hidden = qty.size > 0;
    for (const [sku, q] of qty) {
      const p = CATALOG.find((c) => c.sku === sku);
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

  renderCatalog();
  renderCart();

  return {
    cartId: () => cartId,
    isEmpty: () => qty.size === 0,
    reset() {
      qty.clear();
      cartId = newCartId();
      renderCart();
    },
    payload() {
      const items = [...qty].map(([sku, quantity]) => {
        const p = CATALOG.find((c) => c.sku === sku);
        return { sku, name: p.name, category: p.category, unitPrice: p.unitPrice, quantity };
      });
      const context = { customerTier: $('tier').value, currency: 'USD' };
      if ($('region').value) context.region = $('region').value;
      return { cartId, items, context };
    },
  };
}
