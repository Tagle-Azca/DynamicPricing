import { $ } from './dom.js';
import { initCampaigns, loadCampaigns } from './admin-campaigns.js';
import { initCoupons, loadCoupons } from './admin-coupons.js';
import { initProducts, loadProducts } from './admin-products.js';
import { initMap, loadMap, clearMap } from './admin-map.js';
import { initAudits, loadAudits } from './admin-audits.js';
import { initAdminTabs } from './admin-tabs.js';
import { initCreateToggles } from './admin-create.js';

const TABLES = ['campaigns-table', 'coupons-table', 'products-table', 'audits-table'];

// Wires the admin area once; data loads the first time an admin opens it per session.
export function initAdmin(onProductsChanged) {
  let loaded = false;
  initCampaigns();
  initMap(loadCampaigns);
  initCoupons();
  initProducts(onProductsChanged);
  initAudits();
  initAdminTabs();
  initCreateToggles();

  return {
    load() {
      if (loaded) return;
      loaded = true;
      loadMap();
      loadCampaigns();
      loadCoupons();
      loadProducts();
      loadAudits();
    },
    clear() {
      loaded = false;
      clearMap();
      for (const id of TABLES) $(id).replaceChildren();
    },
  };
}
