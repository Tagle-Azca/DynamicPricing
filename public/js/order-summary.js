import { appendAll, clear, h } from './dom.js';
import { describeError } from './errors.js';
import { formatMoney } from './money.js';
import { skippedSection } from './skipped-rules.js';
import { createCouponBox } from './coupon-box.js';
import { shippingPrice } from './step-delivery.js';
import { thumb } from './thumb.js';

function itemRow(i, catalog, cur) {
  const p = catalog.find(i.sku) || { name: i.name };
  return h(
    'li',
    { class: 'line compact' },
    h(
      'span',
      { class: 'thumb-wrap' },
      thumb(p, 'thumb'),
      h('span', { class: 'qty-badge', 'aria-label': `Quantity ${i.quantity}`, text: i.quantity }),
    ),
    h('p', { class: 'line-name', text: i.name }),
    h('p', { class: 'price', text: formatMoney(i.lineTotal, { currency: cur }) }),
  );
}

function row(label, value, kind = '') {
  return [h('dt', { class: kind, text: label }), h('dd', { class: `price ${kind}`, text: value })];
}

function breakdown(q) {
  const cur = q.currency;
  const rows = [...row('Subtotal', formatMoney(q.subtotal, { currency: cur }))];
  for (const r of q.appliedRules)
    rows.push(...row(r.name, `-${formatMoney(r.discount, { currency: cur })}`, 'discount'));
  if (q.coupon)
    rows.push(
      ...row(
        `Coupon ${q.coupon.code}`,
        `-${formatMoney(q.coupon.discountAmount, { currency: cur })}`,
        'discount',
      ),
    );
  rows.push(
    ...row(
      'Shipping',
      q.shipping ? shippingPrice(q.shipping.amount, cur) : 'Chosen at delivery step',
    ),
  );
  const total = q.grandTotal !== undefined ? q.grandTotal : q.finalTotal;
  rows.push(...row('Total', formatMoney(total, { currency: cur }), 'grand'));
  return h('dl', { class: 'sum' }, rows);
}

// Sticky order summary: every figure is read from the latest server quote.
export function createOrderSummary({ quote, catalog }) {
  const items = h('ul', { class: 'lines' });
  const body = h('div', { class: 'summary-body' });
  const coupon = createCouponBox(quote);
  const node = h(
    'aside',
    { class: 'summary', 'aria-label': 'Order summary' },
    h('h2', { text: 'Order summary' }),
    items,
    coupon.node,
    body,
  );

  function render(snap) {
    const q = snap.data;
    node.setAttribute('aria-busy', String(snap.pending));
    node.classList.toggle('stale', snap.pending);
    coupon.render(snap);
    clear(items);
    clear(body);
    if (!q) {
      if (snap.error)
        body.append(
          h('p', {
            class: 'status',
            'data-kind': 'error',
            role: 'alert',
            text: describeError(snap.error),
          }),
        );
      return;
    }
    items.append(...q.items.map((i) => itemRow(i, catalog, q.currency)));
    appendAll(
      body,
      breakdown(q),
      q.savings > 0
        ? h('p', {
            class: 'saved',
            text: `You save ${formatMoney(q.savings, { currency: q.currency })} on this order`,
          })
        : null,
      skippedSection(q.skippedRules),
    );
  }

  quote.subscribe(render);
  render(quote.snapshot());
  return { node };
}
