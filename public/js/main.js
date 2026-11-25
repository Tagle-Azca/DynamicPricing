import { $ } from './dom.js';
import { setSessionLostHandler } from './api.js';
import { initAuth } from './auth.js';
import { initCatalog } from './catalog.js';
import { initCart } from './cart.js';
import { initPricing } from './pricing.js';
import { initCoupon } from './coupon.js';
import { initCampaigns, loadCampaigns } from './admin-campaigns.js';
import { initCoupons, loadCoupons } from './admin-coupons.js';
import { initProducts, loadProducts } from './admin-products.js';
import { initMap, loadMap, clearMap } from './admin-map.js';
import { initAudits, loadAudits } from './admin-audits.js';
import { initAdminTabs } from './admin-tabs.js';
import { initCreateToggles } from './admin-create.js';

const views = ['auth', 'shop', 'admin'];

function show(name) {
  for (const v of views) $(`view-${v}`).hidden = v !== name;
  for (const tab of document.querySelectorAll('.tab')) {
    tab.setAttribute('aria-pressed', String(tab.dataset.view === name));
  }
}

const catalog = initCatalog({ onAdd: (sku) => cart.add(sku) });
const cart = initCart(() => {
  coupon.onCartChanged();
  pricing.schedule();
}, catalog);
const pricing = initPricing(cart, (data) => coupon.sync(data));
const coupon = initCoupon(cart, pricing);
initCampaigns();
initMap(loadCampaigns);
initCoupons();
initProducts(() => catalog.load());
initAudits();
initAdminTabs();
initCreateToggles();

let adminLoaded = false;

function loginView(user) {
  $('session').hidden = false;
  $('tabs').hidden = false;
  $('session-user').textContent = `${user.email} (${user.role})`;
  const isAdmin = user.role === 'admin';
  document.querySelector('.tab[data-view="admin"]').hidden = !isAdmin;
  adminLoaded = false;
  show('shop');
  catalog.load();
}

function logoutView() {
  cart.reset();
  pricing.reset();
  coupon.reset();
  catalog.reset();
  adminLoaded = false;
  clearMap();
  for (const id of ['campaigns-table', 'coupons-table', 'products-table', 'audits-table'])
    $(id).replaceChildren();
  $('session').hidden = true;
  $('tabs').hidden = true;
  $('session-user').textContent = '';
  document.querySelector('.tab[data-view="admin"]').hidden = true;
  show('auth');
  $('auth-email').focus();
}

const auth = initAuth({ onLogin: loginView, onLogout: logoutView });
setSessionLostHandler((err) => auth.sessionLost(err));

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    const name = tab.dataset.view;
    show(name);
    if (name === 'admin' && !adminLoaded) {
      adminLoaded = true;
      loadMap();
      loadCampaigns();
      loadCoupons();
      loadProducts();
      loadAudits();
    }
  });
}

show('auth');
