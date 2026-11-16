import { $, clear, h, money, setBusy, setStatus } from './dom.js';
import { request, describeError } from './api.js';

export function initCoupon(cart, pricing) {
  const status = $('coupon-status');
  const result = $('coupon-result');
  const button = $('coupon-btn');

  $('coupon-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clear(result);
    const code = $('coupon-code').value.trim();
    const calc = pricing.last();
    if (!code) return setStatus(status, 'Enter a coupon code.', 'error');
    if (!calc)
      return setStatus(status, 'Wait for the price breakdown before applying a coupon.', 'error');
    setBusy(button, true);
    setStatus(status, 'Applying...', 'info');
    try {
      const r = await request('POST', '/coupons/apply', {
        code,
        cartId: cart.cartId(),
        subtotal: calc.subtotal,
      });
      setStatus(status, '');
      result.append(
        h(
          'dl',
          { class: 'totals' },
          h('dt', { text: 'Status' }),
          h('dd', { text: r.status }),
          h('dt', { text: 'Coupon' }),
          h('dd', { text: r.code }),
          h('dt', { text: 'Discount' }),
          h('dd', { class: 'num discount', text: `-${money(r.discountAmount)}` }),
          h('dt', { class: 'grand', text: 'New total' }),
          h('dd', { class: 'num grand', text: money(r.newTotal) }),
          h('dt', { text: 'Remaining uses' }),
          h('dd', { text: String(r.remainingUses) }),
          h('dt', { text: 'Reservation' }),
          h('dd', {}, h('code', { text: r.reservationId })),
        ),
      );
    } catch (err) {
      setStatus(status, describeError(err), 'error');
    } finally {
      setBusy(button, false);
    }
  });

  return {
    reset() {
      clear(result);
      setStatus(status, '');
    },
  };
}
