import { $, setBusy, setStatus } from './dom.js';
import { request } from './api.js';
import { describeError } from './errors.js';
import { compact, int } from './admin-form.js';
import { askConfirm } from './confirm.js';
import { closeEdit, initProductEdit, openEdit } from './admin-product-edit.js';
import { fillCategories, renderProducts } from './admin-product-table.js';

const status = () => $('products-status');
let onChanged = () => {};

async function patch(p, body, button) {
  setBusy(button, true);
  try {
    await request('PATCH', `/admin/products/${encodeURIComponent(p.sku)}`, body);
    await loadProducts();
    setStatus(status(), `Product ${p.sku} updated.`, 'ok');
    onChanged();
  } catch (err) {
    setBusy(button, false);
    setStatus(status(), describeError(err), 'error');
  }
}

function toggle(p, button) {
  const run = () => patch(p, { isActive: !p.isActive }, button);
  if (!p.isActive) return run();
  askConfirm(button, `Deactivate product ${p.sku}?`, 'Deactivate', run);
}

let all = [];

const renderRows = () =>
  renderProducts(all, {
    onEdit: (p, e) => openEdit(p, e.currentTarget.closest('tr'), e.currentTarget),
    onToggle: (p, e) => toggle(p, e.currentTarget),
  });

export async function loadProducts() {
  setStatus(status(), 'Loading products...', 'info');
  try {
    all = await request('GET', '/admin/products');
    fillCategories(all);
    renderRows();
    setStatus(status(), '');
  } catch (err) {
    setStatus(status(), describeError(err), 'error');
  }
}

export function initProducts(onProductsChanged) {
  onChanged = onProductsChanged;
  for (const id of ['pf-search', 'pf-category', 'pf-active']) {
    $(id).addEventListener('input', () => {
      closeEdit();
      renderRows();
    });
  }
  initProductEdit(status, async () => {
    await loadProducts();
    onChanged();
  });
  const form = $('product-create-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const body = compact({
      sku: f.sku.value.trim(),
      name: f.name.value.trim(),
      category: f.category.value.trim(),
      unitPrice: int(f.unitPrice.value),
      currency: f.currency.value.trim().toUpperCase() || undefined,
      imageUrl: f.imageUrl.value.trim() || undefined,
    });
    const btn = form.querySelector('button[type="submit"]');
    setBusy(btn, true);
    try {
      await request('POST', '/admin/products', body);
      form.reset();
      await loadProducts();
      setStatus(status(), `Product ${body.sku.toUpperCase()} created.`, 'ok');
      onChanged();
    } catch (err) {
      setStatus(status(), describeError(err), 'error');
    } finally {
      setBusy(btn, false);
    }
  });
}
