import { clear, h } from './dom.js';
import { formatMoney } from './money.js';
import { icon } from './icons.js';

// Order confirmation, built only from the POST /orders response.
export function renderConfirmation(box, order, onContinue) {
  clear(box);
  const cur = order.currency;
  box.append(
    h(
      'div',
      { class: 'confirm-card' },
      h('span', { class: 'confirm-check' }, icon('check', 32)),
      h('h1', { class: 'confirm-title', tabindex: -1, text: 'Order confirmed' }),
      h('p', { class: 'order-number', text: `Order ${order.orderNumber}` }),
      h('p', { text: `A receipt is on its way to ${order.contact.email}` }),
      h('p', { class: 'hint', text: 'Demo only: no email is sent.' }),
      h(
        'div',
        { class: 'confirm-summary' },
        h(
          'ul',
          { class: 'plain' },
          order.items.map((i) => h('li', { text: `${i.quantity} x ${i.name}` })),
        ),
        h(
          'dl',
          { class: 'sum' },
          h('dt', { class: 'discount', text: 'You saved' }),
          h('dd', { class: 'price discount', text: formatMoney(order.savings, { currency: cur }) }),
          h('dt', { class: 'grand', text: 'Paid' }),
          h('dd', { class: 'price grand', text: formatMoney(order.grandTotal, { currency: cur }) }),
        ),
      ),
      h('button', {
        type: 'button',
        class: 'pill primary big',
        onClick: onContinue,
        text: 'Continue shopping',
      }),
    ),
  );
  box.querySelector('.confirm-title').focus();
}
