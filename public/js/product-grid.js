import { $, clear, h, setStatus } from './dom.js';
import { describeError } from './errors.js';
import { keepFocus } from './focus.js';
import { productCard } from './product-card.js';

// Products section: category chips, item count and the responsive grid.
export function initProductGrid(catalog, cart) {
  let selected = 'All';
  const status = $('catalog-status');
  const retry = $('catalog-retry');

  function chips() {
    const box = $('chips');
    keepFocus(box, () => {
      clear(box);
      for (const name of ['All', ...catalog.categories()]) {
        box.append(
          h('button', {
            type: 'button',
            class: 'chip',
            'data-focus-key': `chip:${name}`,
            'aria-pressed': String(name === selected),
            text: name,
            onClick: () => {
              selected = name;
              render();
            },
          }),
        );
      }
    });
  }

  function render() {
    if (selected !== 'All' && !catalog.categories().includes(selected)) selected = 'All';
    const shown = catalog.all().filter((p) => selected === 'All' || p.category === selected);
    chips();
    $('product-count').textContent = `${shown.length} ${shown.length === 1 ? 'item' : 'items'}`;
    const grid = $('catalog');
    keepFocus(grid, () => {
      clear(grid);
      grid.append(...shown.map((p) => productCard(p, cart)));
    });
  }

  async function load() {
    retry.hidden = true;
    setStatus(status, 'Loading products...', 'info');
    try {
      await catalog.load();
      setStatus(status, catalog.all().length ? '' : 'No products are available right now.', 'info');
    } catch (err) {
      setStatus(status, describeError(err), 'error');
      retry.hidden = false;
    }
  }

  retry.addEventListener('click', load);
  catalog.subscribe(render);
  cart.subscribe(render);
  return { load };
}
