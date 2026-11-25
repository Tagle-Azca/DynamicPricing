import { appendAll, clear, h } from './dom.js';
import { describeError } from './errors.js';
import { formatMoney } from './money.js';
import { icon } from './icons.js';

function line(label, value, kind) {
  return [
    h('dt', { class: kind, text: label }),
    h('dd', { class: `price ${kind || ''}`, text: value }),
  ];
}

export function renderFooter(box, cart, snap, onCheckout) {
  clear(box);
  if (cart.isEmpty()) return;
  const q = snap.data;
  const cur = q && q.currency;
  const dash = '...';
  const rows = [...line('Subtotal', q ? formatMoney(q.subtotal, { currency: cur }) : dash)];
  if (q && q.totalDiscount > 0) {
    rows.push(
      ...line(
        'Campaign discount',
        `-${formatMoney(q.totalDiscount, { currency: cur })}`,
        'discount',
      ),
    );
  }
  rows.push(...line('Total', q ? formatMoney(q.total, { currency: cur }) : dash, 'grand'));
  appendAll(
    box,
    snap.error
      ? h('p', {
          class: 'status',
          'data-kind': 'error',
          role: 'alert',
          text: describeError(snap.error),
        })
      : null,
    h('dl', { class: 'sum' }, rows),
    h('p', { class: 'hint', text: 'Coupons and shipping are added on the checkout page.' }),
    h(
      'button',
      { type: 'button', class: 'pill primary big full', onClick: onCheckout },
      'Go to checkout',
      icon('arrow', 18),
    ),
  );
}
