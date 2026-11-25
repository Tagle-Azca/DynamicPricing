import { $, clear, h, formatDate, setBusy, setStatus } from './dom.js';
import { request } from './api.js';
import { describeError } from './errors.js';

// The coupon is sent with /pricing/calculate; the server reserves it atomically.
// "Remove coupon" releases the reservation with DELETE /coupons/reservations/:id.
export function initCoupon(cart, pricing) {
  const status = $('coupon-status');
  const result = $('coupon-result');
  const button = $('coupon-btn');
  let reservation = null;

  function show(coupon) {
    clear(result);
    reservation = coupon || null;
    if (!coupon) return;
    result.append(
      h('p', {}, `Coupon ${coupon.code} applied. Remaining uses: ${coupon.remainingUses}.`),
      coupon.expiresAt
        ? h('p', { class: 'hint', text: `Reserved until ${formatDate(coupon.expiresAt)}.` })
        : null,
      h('button', {
        type: 'button',
        class: 'btn secondary',
        text: 'Remove coupon',
        onClick: remove,
      }),
    );
  }

  async function release() {
    const held = reservation;
    reservation = null;
    if (!held) return false;
    try {
      await request('DELETE', `/coupons/reservations/${encodeURIComponent(held.reservationId)}`);
    } catch {
      /* already released or expired: nothing left to free */
    }
    return true;
  }

  async function remove() {
    await release();
    clear(result);
    $('coupon-code').value = '';
    setStatus(status, 'Coupon removed.', 'ok');
    pricing.schedule();
  }

  $('coupon-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('coupon-code').value.trim();
    if (!code) return setStatus(status, 'Enter a coupon code.', 'error');
    if (cart.isEmpty())
      return setStatus(status, 'Add a product before applying a coupon.', 'error');
    await release();
    setBusy(button, true);
    setStatus(status, 'Applying...', 'info');
    try {
      const data = await pricing.withCoupon(code);
      if (!data) return;
      setStatus(status, '');
    } catch (err) {
      setStatus(status, describeError(err), 'error');
      pricing.schedule(); // refresh the breakdown without the released coupon
    } finally {
      setBusy(button, false);
    }
  });

  return {
    // Called when the cart or context changes: free the reservation, keep the code typed.
    async onCartChanged() {
      if (await release()) {
        clear(result);
        setStatus(status, 'Cart changed: the coupon was released. Apply it again.', 'info');
      }
    },
    // Follows the server's response so the panel never shows stale coupon state.
    sync(data) {
      if (data && data.coupon) show(data.coupon);
      else if (data) show(null);
    },
    reset() {
      reservation = null;
      clear(result);
      setStatus(status, '');
    },
  };
}
