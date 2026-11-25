import { request } from './api.js';

const DEBOUNCE_MS = 300;

// Live price quote from POST /pricing/calculate. Debounced; stale responses are dropped by a
// sequence counter. Subscribers get { data, error, pending, held } on every change.
// `held` is the last coupon reservation the server reported, kept even if a re-quote fails.
export function createQuote(cart) {
  const subs = new Set();
  let data = null;
  let error = null;
  let pending = false;
  let held = null;
  let seq = 0;
  let timer = null;

  const snapshot = () => ({ data, error, pending, held });
  const emit = () => subs.forEach((fn) => fn(snapshot()));

  function accept(next) {
    data = next;
    error = null;
    held = next.coupon || null;
    pending = false;
  }

  async function run() {
    const mine = ++seq;
    pending = true;
    error = null;
    emit();
    try {
      const next = await request('POST', '/pricing/calculate', cart.payload());
      if (mine !== seq) return;
      accept(next);
    } catch (err) {
      if (mine !== seq) return;
      data = null;
      error = err;
      pending = false;
    }
    emit();
  }

  function release(reservationId) {
    // Best effort: an expired or already released reservation has nothing left to free.
    return request('DELETE', `/coupons/reservations/${encodeURIComponent(reservationId)}`).catch(
      () => {},
    );
  }

  function drop() {
    clearTimeout(timer);
    seq += 1;
    const old = held;
    data = null;
    error = null;
    held = null;
    pending = false;
    if (old && old.reservationId) release(old.reservationId);
    emit();
  }

  const schedule = () => {
    if (cart.isEmpty()) return drop();
    clearTimeout(timer);
    seq += 1;
    pending = true;
    emit();
    timer = setTimeout(run, DEBOUNCE_MS);
  };

  cart.subscribe(schedule);

  return {
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    snapshot,
    now() {
      clearTimeout(timer);
      return run();
    },
    // Reserve a coupon through calculate. Throws on failure; the cart keeps its old state.
    async apply(code) {
      clearTimeout(timer);
      const mine = ++seq;
      const next = await request('POST', '/pricing/calculate', {
        ...cart.payload(),
        couponCode: code,
      });
      if (mine !== seq) {
        // Stale for display, but the server may have reserved the coupon: never leave it held.
        const stale = next.coupon && next.coupon.reservationId;
        if (stale && !(held && held.reservationId === stale)) release(stale);
        return;
      }
      cart.setCoupon(code);
      accept(next);
      emit();
    },
    async removeCoupon() {
      const old = held;
      cart.setCoupon(null);
      held = null;
      if (old && old.reservationId) await release(old.reservationId);
      return run();
    },
    // Logout: free a held (not consumed) reservation without waiting for it, then forget.
    releaseHeld() {
      const old = held;
      this.forget();
      if (old && old.reservationId) release(old.reservationId);
    },
    // After an order the coupon is consumed: forget everything without releasing.
    forget() {
      clearTimeout(timer);
      seq += 1;
      data = null;
      error = null;
      held = null;
      pending = false;
      emit();
    },
  };
}
