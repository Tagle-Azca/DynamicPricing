import { $, money, setBusy, setStatus } from './dom.js';
import { request } from './api.js';
import { describeError } from './errors.js';
import { thumb } from './thumb.js';

// Edit form for one product. Sends only the fields that changed (PATCH).
let current = null;

const form = () => $('product-edit-form');

export function diff(product, values) {
  const body = {};
  for (const key of ['name', 'category', 'unitPrice', 'currency', 'imageUrl', 'isActive']) {
    if (values[key] !== (product[key] ?? null)) body[key] = values[key];
  }
  return body;
}

function readForm() {
  const f = form().elements;
  return {
    name: f.name.value.trim(),
    category: f.category.value.trim(),
    unitPrice: f.unitPrice.valueAsNumber,
    currency: f.currency.value.trim().toUpperCase(),
    imageUrl: f.imageUrl.value.trim() || null,
    isActive: f.isActive.checked,
  };
}

function refreshPreview() {
  const f = form().elements;
  const cents = f.unitPrice.valueAsNumber;
  $('pe-price-preview').textContent = Number.isInteger(cents) && cents >= 0 ? money(cents) : '-';
  const url = f.imageUrl.value.trim();
  $('pe-preview').replaceChildren(
    thumb({ imageUrl: url || null, name: f.name.value }, 'row-thumb'),
  );
}

export function closeEdit() {
  current = null;
  $('product-edit').hidden = true;
  for (const tr of document.querySelectorAll('tr.is-editing')) tr.classList.remove('is-editing');
}

export function openEdit(product, row, opener) {
  closeEdit();
  current = { product, opener };
  row.classList.add('is-editing');
  const f = form().elements;
  f.name.value = product.name;
  f.category.value = product.category;
  f.unitPrice.value = product.unitPrice;
  f.currency.value = product.currency;
  f.imageUrl.value = product.imageUrl || '';
  f.isActive.checked = product.isActive;
  $('product-edit-title').textContent = `Edit product ${product.sku}`;
  refreshPreview();
  $('product-edit').hidden = false;
  $('product-edit-title').focus();
  $('product-edit').scrollIntoView({ block: 'nearest' });
}

export function initProductEdit(status, onSaved) {
  for (const id of ['pe-name', 'pe-price', 'pe-image'])
    $(id).addEventListener('input', refreshPreview);
  $('pe-cancel').addEventListener('click', () => {
    const opener = current && current.opener;
    closeEdit();
    if (opener && opener.isConnected) opener.focus();
  });
  form().addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!current) return;
    const values = readForm();
    if (!values.name || !values.category || !values.currency) {
      return setStatus(status(), 'Name, category and currency are required.', 'error');
    }
    if (!Number.isInteger(values.unitPrice) || values.unitPrice < 0) {
      return setStatus(status(), 'Price must be a whole number of cents.', 'error');
    }
    const body = diff(current.product, values);
    if (Object.keys(body).length === 0) return setStatus(status(), 'No changes to save.', 'info');
    const btn = form().querySelector('button[type="submit"]');
    setBusy(btn, true);
    try {
      const sku = current.product.sku;
      await request('PATCH', `/admin/products/${encodeURIComponent(sku)}`, body);
      closeEdit();
      await onSaved();
      setStatus(status(), `Product ${sku} updated.`, 'ok');
    } catch (err) {
      setStatus(status(), describeError(err), 'error');
    } finally {
      setBusy(btn, false);
    }
  });
}
