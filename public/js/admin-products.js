import { $, h, money, renderTable, setBusy, setStatus } from './dom.js';
import { request } from './api.js';
import { describeError } from './errors.js';
import { compact, int } from './admin-form.js';

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

function priceEditor(p) {
  const id = `price-${p.sku}`;
  const input = h('input', {
    id,
    type: 'number',
    min: 0,
    step: 1,
    value: p.unitPrice,
    class: 'qty',
  });
  return h(
    'div',
    { class: 'row' },
    h('label', { class: 'sr-only', for: id, text: `New price in cents for ${p.sku}` }),
    input,
    h('button', {
      type: 'button',
      class: 'btn small',
      text: 'Save price',
      'aria-label': `Save price for ${p.sku}`,
      onClick: (e) => {
        const value = input.valueAsNumber;
        if (!Number.isInteger(value) || value < 0) {
          return setStatus(status(), 'Price must be a whole number of cents.', 'error');
        }
        patch(p, { unitPrice: value }, e.currentTarget);
      },
    }),
  );
}

export async function loadProducts() {
  setStatus(status(), 'Loading products...', 'info');
  try {
    const rows = await request('GET', '/admin/products');
    renderTable(
      $('products-table'),
      [
        { label: 'SKU', cell: (p) => p.sku },
        { label: 'Name', cell: (p) => p.name },
        { label: 'Category', cell: (p) => p.category },
        { label: 'Price', cell: (p) => `${money(p.unitPrice)} ${p.currency}` },
        { label: 'Active', cell: (p) => (p.isActive ? 'Yes' : 'No') },
        { label: 'Edit price (cents)', cell: priceEditor },
        {
          label: 'Action',
          cell: (p) =>
            h('button', {
              type: 'button',
              class: 'btn small secondary',
              'aria-label': `${p.isActive ? 'Deactivate' : 'Activate'} product ${p.sku}`,
              text: p.isActive ? 'Deactivate' : 'Activate',
              onClick: (e) => patch(p, { isActive: !p.isActive }, e.currentTarget),
            }),
        },
      ],
      rows,
      'Products',
    );
    setStatus(status(), '');
  } catch (err) {
    setStatus(status(), describeError(err), 'error');
  }
}

export function initProducts(onProductsChanged) {
  onChanged = onProductsChanged;
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
