import { $ } from './dom.js';
import { icon } from './icons.js';

// Header chrome: Cart pill badge, nav state, and which header (shop/checkout) is visible.
export function initShell(cart) {
  for (const [id, name, size] of [
    ['logo-mark', 'logo', 20],
    ['logo-mark-2', 'logo', 20],
    ['cart-icon', 'cart', 18],
    ['lock-icon', 'lock', 16],
    ['back-icon', 'back', 16],
    ['close-icon', 'close', 20],
  ]) {
    $(id).append(icon(name, size));
  }
  const count = $('cart-count');
  const button = $('cart-btn');
  const sync = () => {
    const n = cart.count();
    count.textContent = String(n);
    count.hidden = n === 0;
    button.setAttribute(
      'aria-label',
      n === 0 ? 'Open cart, empty' : `Open cart, ${n} ${n === 1 ? 'item' : 'items'}`,
    );
  };
  cart.subscribe(sync);
  sync();

  return {
    // view: auth | shop | admin | checkout
    show(view, loggedIn) {
      for (const v of ['auth', 'shop', 'admin', 'checkout']) $(`view-${v}`).hidden = v !== view;
      $('site-header').hidden = view === 'checkout';
      $('checkout-header').hidden = view !== 'checkout';
      $('site-nav').hidden = !loggedIn;
      $('header-end').hidden = !loggedIn;
      document.body.classList.toggle('admin-mode', view === 'admin');
      for (const tab of document.querySelectorAll('.nav-pill')) {
        tab.setAttribute('aria-current', tab.dataset.view === view ? 'page' : 'false');
      }
    },
  };
}
