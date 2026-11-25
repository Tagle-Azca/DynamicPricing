import { clear, h } from './dom.js';
import { formatMoney } from './money.js';
import { icon } from './icons.js';
import { offerText, progressState } from './campaigns.js';
import { progressView } from './progress-view.js';
import { stepper } from './stepper.js';
import { thumb } from './thumb.js';

function row(cart, catalog, snap, sku) {
  const product = catalog.find(sku) || { name: sku };
  const line = snap.data && snap.data.items.find((i) => i.sku === sku);
  const qty = cart.qtyOf(sku);
  const total = line ? formatMoney(line.lineTotal, { currency: snap.data.currency }) : '...';
  return h(
    'li',
    { class: 'line' },
    thumb(product, 'thumb'),
    h(
      'div',
      { class: 'line-main' },
      h(
        'div',
        { class: 'line-top' },
        h('p', { class: 'line-name', text: product.name }),
        h('p', { class: `price line-total${snap.pending ? ' stale' : ''}`, text: total }),
      ),
      h(
        'div',
        { class: 'line-actions' },
        stepper(
          product.name,
          qty,
          { onDec: () => cart.setQty(sku, qty - 1), onInc: () => cart.setQty(sku, qty + 1) },
          `d-${sku}`,
        ),
        h('button', {
          type: 'button',
          class: 'link-btn',
          'data-focus-key': `d-${sku}:rm`,
          'aria-label': `Remove ${product.name}`,
          onClick: () => cart.remove(sku),
          text: 'Remove',
        }),
      ),
    ),
  );
}

export function renderProgress(box, campaign, snap, cartEmpty) {
  clear(box);
  if (!campaign || cartEmpty) return;
  const state = progressState(campaign, snap, cartEmpty);
  const view = progressView(state, `Progress toward ${campaign.code}`);
  box.append(view || h('p', { class: 'progress-text', text: offerText(campaign) }));
}

export function renderItems(box, cart, catalog, snap, onBrowse) {
  clear(box);
  if (cart.isEmpty()) {
    box.append(
      h(
        'div',
        { class: 'empty' },
        icon('cart', 40),
        h('h3', { text: 'Your cart is empty' }),
        h('p', { class: 'muted', text: 'Add something you like and it will show up here.' }),
        h('button', {
          type: 'button',
          class: 'pill primary',
          onClick: onBrowse,
          text: 'Browse products',
        }),
      ),
    );
    return;
  }
  box.append(
    h(
      'ul',
      { class: 'lines' },
      cart.skus().map((sku) => row(cart, catalog, snap, sku)),
    ),
  );
}
