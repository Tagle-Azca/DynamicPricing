import { h } from './dom.js';
import { formatMoney } from './money.js';
import { thumb } from './thumb.js';
import { stepper } from './stepper.js';

// One product card. The stepper replaces the Add button once the item is in the cart.
export function productCard(p, cart) {
  const inCart = cart.qtyOf(p.sku);
  const media = h('div', { class: 'card-media' }, thumb(p, 'media-img'));
  if (inCart) media.append(h('span', { class: 'in-cart-badge', text: `${inCart} in cart` }));
  const action = inCart
    ? stepper(
        p.name,
        inCart,
        {
          onDec: () => cart.setQty(p.sku, inCart - 1),
          onInc: () => cart.setQty(p.sku, inCart + 1),
        },
        `p-${p.sku}`,
      )
    : h('button', {
        type: 'button',
        class: 'pill primary full',
        'data-focus-key': `p-${p.sku}:add`,
        'aria-label': `Add ${p.name} to cart`,
        onClick: () => cart.add(p.sku),
        text: 'Add to cart',
      });
  return h(
    'li',
    { class: 'product' },
    media,
    h(
      'div',
      { class: 'product-body' },
      h('p', { class: 'product-cat', text: p.category }),
      h('h3', { class: 'product-name', text: p.name }),
      h('p', { class: 'price', text: formatMoney(p.unitPrice, { currency: p.currency }) }),
      action,
    ),
  );
}
