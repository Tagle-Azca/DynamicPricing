import { $, setStatus } from './dom.js';
import { request, describeError } from './api.js';
import { renderResult, clearResult } from './price-view.js';

const DEBOUNCE_MS = 300;

// Live pricing: debounced, and stale responses are discarded via a sequence counter.
// onResult(data|null) lets the coupon panel follow the server's coupon state.
export function initPricing(cart, onResult) {
  let timer = null;
  let seq = 0;
  const status = $('calc-status');

  function drop() {
    clearTimeout(timer);
    seq += 1; // invalidate any in-flight response immediately
    clearResult();
    setStatus(status, '');
    onResult(null);
  }

  async function run() {
    const mine = ++seq;
    setStatus(status, 'Calculating...', 'info');
    try {
      const data = await request('POST', '/pricing/calculate', cart.payload());
      if (mine !== seq) return;
      renderResult(data);
      setStatus(status, '');
      onResult(data);
    } catch (err) {
      if (mine !== seq) return;
      clearResult();
      setStatus(status, describeError(err), 'error');
      onResult(null);
    }
  }

  return {
    schedule() {
      if (cart.isEmpty()) return drop();
      clearTimeout(timer);
      seq += 1;
      timer = setTimeout(run, DEBOUNCE_MS);
    },
    // Explicit calculation with a coupon. Throws on failure; the caller shows the error
    // and the previous breakdown stays on screen.
    async withCoupon(code) {
      clearTimeout(timer);
      const mine = ++seq;
      const data = await request('POST', '/pricing/calculate', cart.payload(code));
      if (mine !== seq) return null;
      renderResult(data);
      setStatus(status, '');
      onResult(data);
      return data;
    },
    reset: drop,
  };
}
