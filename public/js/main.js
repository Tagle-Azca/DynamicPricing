import { $ } from './dom.js';
import { setSessionLostHandler } from './api.js';
import { initAuth } from './auth.js';
import { createCatalog } from './catalog.js';
import { createCart } from './cart-store.js';
import { createQuote } from './quote.js';
import { loadBannerCampaign } from './campaigns.js';
import { initBanner } from './banner.js';
import { initProductGrid } from './product-grid.js';
import { initDrawer } from './drawer.js';
import { initCheckout } from './checkout.js';
import { initShell } from './shell.js';
import { currentRoute, go, onRouteChange, resolveView } from './router.js';
import { initAdmin } from './admin-boot.js';

const catalog = createCatalog();
const cart = createCart();
const quote = createQuote(cart);
const campaignRef = { current: null };
const shell = initShell(cart);
const grid = initProductGrid(catalog, cart);
const banner = initBanner(cart, quote, campaignRef);
const drawer = initDrawer({ cart, quote, catalog, campaignRef, opener: $('cart-btn') });
const checkout = initCheckout({ cart, quote, catalog });
const admin = initAdmin(() => grid.load());

let user = null;
let adminOpen = false;

// One place decides what is visible. Not logged in always shows the auth view.
function render() {
  const view = resolveView({
    user,
    route: currentRoute(),
    cartEmpty: cart.isEmpty(),
    confirmed: checkout.isConfirmed(),
    adminOpen,
  });
  if (view === 'redirect') return document.location.replace('#/');
  shell.show(view, Boolean(user));
  if (view === 'admin') admin.load();
  if (view === 'checkout') checkout.enter();
}

async function loginView(u) {
  user = u;
  adminOpen = false;
  $('session-user').textContent = u.email;
  document.querySelector('.nav-pill[data-view="admin"]').hidden = u.role !== 'admin';
  checkout.setUser(u);
  render();
  campaignRef.current = await loadBannerCampaign();
  banner.render();
  grid.load();
}

function logoutView() {
  drawer.close(false);
  user = null;
  adminOpen = false;
  quote.forget();
  cart.reset();
  checkout.reset();
  catalog.reset();
  campaignRef.current = null;
  banner.render();
  admin.clear();
  $('session-user').textContent = '';
  document.location.hash = '#/';
  render();
  $('auth-email').focus();
}

const auth = initAuth({
  onLogin: loginView,
  onLogout: logoutView,
  beforeLogout: () => quote.releaseHeld(),
});
setSessionLostHandler((err) => auth.sessionLost(err));

for (const pill of document.querySelectorAll('.nav-pill')) {
  pill.addEventListener('click', () => {
    adminOpen = pill.dataset.view === 'admin';
    if (currentRoute() !== 'shop') go('shop');
    else render();
  });
}
onRouteChange(() => {
  drawer.close(false);
  if (currentRoute() === 'shop') adminOpen = false;
  render();
});
render();
