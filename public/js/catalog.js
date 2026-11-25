import { $, clear, h, money, setBusy, setStatus } from './dom.js';
import { request, describeError } from './api.js';

// Store catalog loaded from GET /catalog. Prices are integer cents from the server.
export function initCatalog({ onAdd }) {
  let products = [];
  const status = $('catalog-status');
  const retry = $('catalog-retry');

  function render() {
    const list = $('catalog');
    clear(list);
    for (const p of products) {
      list.append(
        h(
          'li',
          { class: 'item' },
          h(
            'span',
            { class: 'grow' },
            h('strong', { text: p.name }),
            h('span', { class: 'muted', text: ` ${p.category}` }),
          ),
          h('span', { class: 'num', text: `${money(p.unitPrice)} ${p.currency}` }),
          h('button', {
            type: 'button',
            class: 'btn small',
            'aria-label': `Add ${p.name} to cart`,
            onClick: () => onAdd(p.sku),
            text: 'Add',
          }),
        ),
      );
    }
  }

  async function load() {
    retry.hidden = true;
    setBusy(retry, true);
    setStatus(status, 'Loading products...', 'info');
    try {
      products = await request('GET', '/catalog');
      render();
      setStatus(status, products.length ? '' : 'No products are available right now.', 'info');
    } catch (err) {
      products = [];
      render();
      setStatus(status, describeError(err), 'error');
      retry.hidden = false;
    } finally {
      setBusy(retry, false);
    }
  }

  retry.addEventListener('click', load);

  return {
    load,
    find: (sku) => products.find((p) => p.sku === sku),
    reset() {
      products = [];
      render();
      setStatus(status, '');
      retry.hidden = true;
    },
  };
}
