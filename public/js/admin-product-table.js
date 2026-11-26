import { $, h, money, renderTable } from './dom.js';
import { thumb } from './thumb.js';

export function matches(p, { text, category, active }) {
  const q = text.trim().toLowerCase();
  if (q && !`${p.sku} ${p.name}`.toLowerCase().includes(q)) return false;
  if (category && p.category !== category) return false;
  if (active === 'yes' && !p.isActive) return false;
  if (active === 'no' && p.isActive) return false;
  return true;
}

export function fillCategories(all) {
  const select = $('pf-category');
  const keep = select.value;
  const names = [...new Set(all.map((p) => p.category))].sort();
  select.replaceChildren(
    h('option', { value: '', text: 'All' }),
    ...names.map((n) => h('option', { value: n, text: n })),
  );
  select.value = names.includes(keep) ? keep : '';
}

export function renderProducts(all, { onEdit, onToggle }) {
  const rows = all.filter((p) =>
    matches(p, {
      text: $('pf-search').value,
      category: $('pf-category').value,
      active: $('pf-active').value,
    }),
  );
  $('products-count').textContent = `${rows.length} of ${all.length} products`;
  renderTable(
    $('products-table'),
    [
      { label: 'Image', cell: (p) => thumb(p, 'row-thumb') },
      { label: 'SKU', cell: (p) => p.sku },
      { label: 'Name', cell: (p) => p.name },
      { label: 'Category', cell: (p) => p.category },
      { label: 'Price', cell: (p) => `${money(p.unitPrice)} ${p.currency}` },
      { label: 'Active', cell: (p) => (p.isActive ? 'Yes' : 'No') },
      {
        label: 'Actions',
        cell: (p) =>
          h(
            'div',
            { class: 'row' },
            h('button', {
              type: 'button',
              class: 'btn small',
              text: 'Edit',
              'aria-label': `Edit product ${p.sku}`,
              onClick: (e) => onEdit(p, e),
            }),
            h('button', {
              type: 'button',
              class: 'btn small secondary',
              'aria-label': `${p.isActive ? 'Deactivate' : 'Activate'} product ${p.sku}`,
              text: p.isActive ? 'Deactivate' : 'Activate',
              onClick: (e) => onToggle(p, e),
            }),
          ),
      },
    ],
    rows,
    'Products',
  );
}
