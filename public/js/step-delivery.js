import { clear, h } from './dom.js';
import { formatMoney } from './money.js';
import { keepFocus } from './focus.js';

export const shippingPrice = (amount, currency) =>
  amount === 0 ? 'Free' : formatMoney(amount, { currency });

// Step 2: radio cards from the server's shippingOptions. Choosing one re-quotes the cart.
export function createDeliveryStep({ cart, quote, onDone }) {
  const options = h('div', {
    class: 'radio-cards',
    role: 'radiogroup',
    'aria-label': 'Delivery method',
  });
  const status = h('p', { class: 'status', role: 'status' });
  const next = h('button', {
    type: 'submit',
    class: 'pill primary big',
    text: 'Continue to payment',
  });

  function card(o, currency) {
    const on = cart.delivery() === o.method;
    return h(
      'label',
      { class: `radio-card${on ? ' selected' : ''}` },
      h('input', {
        type: 'radio',
        name: 'delivery',
        value: o.method,
        checked: on,
        'data-focus-key': `dl:${o.method}`,
        onChange: () => cart.setDelivery(o.method),
      }),
      h(
        'span',
        { class: 'radio-text' },
        h('strong', { text: o.label }),
        h('span', { class: 'muted', text: o.eta }),
      ),
      h('span', { class: 'price', text: shippingPrice(o.amount, currency) }),
    );
  }

  function render(snap) {
    const data = snap.data;
    keepFocus(options, () => {
      clear(options);
      if (data) options.append(...data.shippingOptions.map((o) => card(o, data.currency)));
    });
    // Continue needs a settled quote that already includes the chosen delivery.
    next.disabled = !(data && data.shipping && !snap.pending);
    status.textContent = snap.error ? 'Could not load delivery options. Try again.' : '';
  }

  const form = h(
    'form',
    {
      class: 'step-body',
      novalidate: true,
      onSubmit: (e) => {
        e.preventDefault();
        if (!next.disabled) onDone();
      },
    },
    options,
    status,
    next,
  );
  quote.subscribe(render);
  render(quote.snapshot());
  return {
    node: form,
    // Preselect Standard the first time the step opens.
    enter: () => {
      if (!cart.delivery()) cart.setDelivery('standard');
    },
    summary: (data) =>
      data && data.shipping ? `${data.shipping.label}, ${data.shipping.eta}` : '',
  };
}
