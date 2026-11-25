import { $, clear, h, money } from './dom.js';

function ruleValue(r) {
  return r.type === 'percentage' ? `${r.value}%` : money(r.value);
}

function section(title, children) {
  return h('div', { class: 'block' }, h('h3', { text: title }), children);
}

function appliedList(rules) {
  if (!rules.length) return h('p', { class: 'muted', text: 'No campaigns applied.' });
  return h(
    'ul',
    { class: 'list' },
    rules.map((a) =>
      h(
        'li',
        { class: 'item' },
        h('span', { class: 'grow', text: `${a.code} - ${a.name} (${ruleValue(a)})` }),
        h('span', { class: 'num discount', text: `-${money(a.discount)}` }),
      ),
    ),
  );
}

function skippedList(rules) {
  if (!rules.length) return h('p', { class: 'muted', text: 'None.' });
  return h(
    'ul',
    { class: 'list' },
    rules.map((s) => h('li', { class: 'item muted', text: `${s.code}: ${s.reason}` })),
  );
}

function totals(r) {
  const cur = r.currency;
  const rows = [
    h('dt', { text: 'Subtotal' }),
    h('dd', { class: 'num', text: `${money(r.subtotal)} ${cur}` }),
    h('dt', { text: 'Campaign discounts' }),
    h('dd', { class: 'num discount', text: `-${money(r.totalDiscount)}` }),
    h('dt', { text: 'Total after campaigns' }),
    h('dd', { class: 'num', text: `${money(r.total)} ${cur}` }),
  ];
  if (r.coupon) {
    rows.push(
      h('dt', { text: `Coupon ${r.coupon.code}` }),
      h('dd', { class: 'num discount', text: `-${money(r.coupon.discountAmount)}` }),
    );
  }
  rows.push(
    h('dt', { class: 'grand', text: 'Final total' }),
    h('dd', { class: 'num grand', text: `${money(r.finalTotal)} ${cur}` }),
  );
  return h('dl', { class: 'totals' }, rows);
}

// Every figure comes from the server response; nothing is computed here.
export function renderResult(r) {
  const box = $('breakdown');
  clear(box);
  box.append(
    totals(r),
    section('Applied campaigns', appliedList(r.appliedRules)),
    section('Skipped rules', skippedList(r.skippedRules)),
    h('p', { class: 'muted' }, 'Audit id: ', h('code', { text: r.auditId })),
  );
}

export function clearResult() {
  clear($('breakdown'));
}
