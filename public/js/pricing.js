import { $, clear, h, money, setStatus } from './dom.js';
import { request, describeError } from './api.js';

const DEBOUNCE_MS = 300;

function ruleValue(r) {
  return r.type === 'percentage' ? `${r.value}%` : money(r.value);
}

function section(title, children) {
  return h('div', { class: 'block' }, h('h3', { text: title }), children);
}

function renderResult(r) {
  const box = $('breakdown');
  clear(box);
  const applied = r.appliedRules.length
    ? h(
        'ul',
        { class: 'list' },
        r.appliedRules.map((a) =>
          h(
            'li',
            { class: 'item' },
            h('span', { class: 'grow', text: `${a.code} - ${a.name} (${ruleValue(a)})` }),
            h('span', { class: 'num discount', text: `-${money(a.discount)}` }),
          ),
        ),
      )
    : h('p', { class: 'muted', text: 'No rules applied.' });
  const skipped = r.skippedRules.length
    ? h(
        'ul',
        { class: 'list' },
        r.skippedRules.map((s) => h('li', { class: 'item muted', text: `${s.code}: ${s.reason}` })),
      )
    : h('p', { class: 'muted', text: 'None.' });
  box.append(
    h(
      'dl',
      { class: 'totals' },
      h('dt', { text: 'Subtotal' }),
      h('dd', { class: 'num', text: `${money(r.subtotal)} ${r.currency}` }),
      h('dt', { text: 'Discount' }),
      h('dd', { class: 'num', text: `-${money(r.totalDiscount)}` }),
      h('dt', { class: 'grand', text: 'Total' }),
      h('dd', { class: 'num grand', text: `${money(r.total)} ${r.currency}` }),
    ),
    section('Applied rules', applied),
    section('Skipped rules', skipped),
    h('p', { class: 'muted' }, 'Audit id: ', h('code', { text: r.auditId })),
  );
}

// Live pricing: debounced, and stale responses are discarded via a sequence counter.
export function initPricing(cart) {
  let timer = null;
  let seq = 0;
  let last = null;
  const status = $('calc-status');

  async function run() {
    const mine = ++seq;
    setStatus(status, 'Calculating...', 'info');
    try {
      const data = await request('POST', '/pricing/calculate', cart.payload());
      if (mine !== seq) return; // a newer request superseded this one
      last = data;
      renderResult(data);
      setStatus(status, '');
    } catch (err) {
      if (mine !== seq) return;
      last = null;
      clear($('breakdown'));
      setStatus(status, describeError(err), 'error');
    }
  }

  return {
    last: () => last,
    schedule() {
      clearTimeout(timer);
      seq += 1; // invalidate any in-flight response immediately
      last = null;
      if (cart.isEmpty()) {
        clear($('breakdown'));
        setStatus(status, '');
        return;
      }
      timer = setTimeout(run, DEBOUNCE_MS);
    },
    reset() {
      clearTimeout(timer);
      seq += 1;
      last = null;
      clear($('breakdown'));
      setStatus(status, '');
    },
  };
}
