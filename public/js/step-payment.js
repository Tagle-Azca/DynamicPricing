import { h } from './dom.js';
import { field, showErrors } from './field.js';
import { validatePayment } from './validate.js';

// Step 3: demo card form. Values are validated in the browser and never sent anywhere.
export function createPaymentStep({ onPay }) {
  const f = {
    number: field({
      id: 'pay-number',
      label: 'Card number',
      inputmode: 'numeric',
      autocomplete: 'cc-number',
      maxlength: 23,
      wrap: 'span-2',
    }),
    expiry: field({
      id: 'pay-exp',
      label: 'Expiry (MM/YY)',
      autocomplete: 'cc-exp',
      placeholder: 'MM/YY',
      maxlength: 7,
    }),
    cvc: field({
      id: 'pay-cvc',
      label: 'CVC',
      inputmode: 'numeric',
      autocomplete: 'cc-csc',
      maxlength: 4,
    }),
    cardName: field({
      id: 'pay-name',
      label: 'Name on card',
      autocomplete: 'cc-name',
      wrap: 'span-2',
    }),
  };
  const status = h('p', { class: 'status span-2', role: 'alert' });
  const pay = h('button', { type: 'submit', class: 'pill primary big full span-2', text: 'Pay' });
  let busy = false;
  let enabled = false;
  let label = 'Pay';
  const sync = () => {
    pay.textContent = busy ? 'Placing order...' : label;
    pay.disabled = busy || !enabled;
    pay.setAttribute('aria-busy', String(busy));
  };

  const form = h(
    'form',
    {
      class: 'step-body form-cols',
      novalidate: true,
      autocomplete: 'off',
      onSubmit: (e) => {
        e.preventDefault();
        const v = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, x.value()]));
        if (showErrors(f, validatePayment(v))) onPay();
      },
    },
    h('p', {
      class: 'demo-note span-2',
      text: 'Demo only: no card is charged. These fields never leave your browser.',
    }),
    Object.values(f).map((x) => x.node),
    status,
    pay,
  );
  return {
    node: form,
    status,
    pay,
    setLabel(text, ok) {
      label = text;
      enabled = ok;
      sync();
    },
    setBusy(value) {
      busy = value;
      sync();
    },
    reset() {
      form.reset();
      for (const x of Object.values(f)) x.setError('');
      status.textContent = '';
    },
  };
}
