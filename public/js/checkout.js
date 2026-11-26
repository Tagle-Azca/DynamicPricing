import { $, setStatus } from './dom.js';
import { request } from './api.js';
import { describeError } from './errors.js';
import { formatMoney } from './money.js';
import { renderConfirmation } from './confirmation.js';
import { createContactStep } from './step-contact.js';
import { createDeliveryStep } from './step-delivery.js';
import { createPaymentStep } from './step-payment.js';
import { createOrderSummary } from './order-summary.js';
import { stepCard } from './step-card.js';
import { createSteps } from './steps.js';
import { go } from './router.js';

const REQUOTE_CODES = ['PRICE_CHANGED', 'AUDIT_STALE', 'COUPON_RESERVATION_INVALID'];
// Checkout page: three accordion steps, sticky summary, order placement and confirmation.
export function initCheckout({ cart, quote, catalog }) {
  const steps = createSteps();
  let confirmed = false;
  let user = null;

  const contact = createContactStep({ cart, onDone: () => advance(0) });
  const delivery = createDeliveryStep({ cart, quote, onDone: () => advance(1) });
  const payment = createPaymentStep({ onPay: placeOrder });
  const cards = [
    stepCard(1, 'Contact & address', contact.node, () => open(0)),
    stepCard(2, 'Delivery', delivery.node, () => open(1)),
    stepCard(3, 'Payment', payment.node, () => open(2)),
  ];
  $('checkout-steps').append(...cards.map((c) => c.node));
  $('checkout-summary').append(createOrderSummary({ quote, catalog }).node);

  const summaries = () => [contact.summary(), delivery.summary(quote.snapshot().data), 'Demo card'];

  function paint() {
    const text = summaries();
    const states = steps.states();
    cards.forEach((card, i) => card.update(states[i], text[i]));
  }

  function open(i) {
    steps.open(i);
    if (i === 1) delivery.enter();
    paint();
  }

  function advance(i) {
    steps.advance(i);
    if (i + 1 === 1) delivery.enter();
    paint();
  }

  function renderPay(snap) {
    const q = snap.data;
    const total = q ? (q.grandTotal !== undefined ? q.grandTotal : q.finalTotal) : null;
    const label = total === null ? 'Pay' : `Pay ${formatMoney(total, { currency: q.currency })}`;
    payment.setLabel(label, Boolean(q && q.shipping && !snap.pending));
    paint();
  }
  quote.subscribe(renderPay);

  async function placeOrder() {
    const snap = quote.snapshot();
    if (!snap.data || !snap.data.shipping) return;
    const c = contact.values();
    payment.setBusy(true);
    setStatus(payment.status, '');
    try {
      const order = await request('POST', '/orders', {
        auditId: snap.data.auditId,
        contact: { email: c.email, fullName: c.fullName },
        address: { street: c.street, city: c.city, postalCode: c.postalCode, region: c.region },
      });
      confirmed = true;
      quote.forget();
      cart.reset();
      $('checkout-layout').hidden = true;
      $('checkout-done').hidden = false;
      renderConfirmation($('checkout-done'), order, () => {
        reset();
        go('shop');
      });
    } catch (err) {
      payment.setBusy(false);
      if (REQUOTE_CODES.includes(err.code)) {
        await quote.now();
        setStatus(
          payment.status,
          'Prices changed since you last looked. Review the new total, then pay again.',
          'error',
        );
      } else setStatus(payment.status, describeError(err), 'error');
    }
  }

  function reset() {
    steps.reset();
    confirmed = false;
    contact.reset();
    payment.reset();
    payment.setBusy(false);
    $('checkout-layout').hidden = false;
    $('checkout-done').hidden = true;
    paint();
  }

  return {
    isConfirmed: () => confirmed,
    setUser(u) {
      user = u;
    },
    // Called when the route becomes #/checkout with a non-empty cart.
    enter() {
      if (user) contact.prefill(user.email);
      paint();
      quote.now();
      if (!confirmed) contact.focus();
    },
    reset,
  };
}
