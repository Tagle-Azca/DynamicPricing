import { $ } from './dom.js';
import { keepFocus } from './focus.js';
import { go } from './router.js';
import { createDrawerController } from './drawer-controller.js';
import { renderItems, renderProgress } from './drawer-view.js';
import { renderFooter } from './drawer-footer.js';

// Cart drawer: wires the controller to the cart, the quote and the catalog.
export function initDrawer({ cart, quote, catalog, campaignRef, opener }) {
  const panel = $('drawer');
  let drawer = null;

  function render() {
    const snap = quote.snapshot();
    keepFocus(panel, () => {
      renderProgress($('drawer-progress'), campaignRef.current, snap, cart.isEmpty());
      renderItems($('drawer-body'), cart, catalog, snap, () => drawer.close());
      renderFooter($('drawer-foot'), cart, snap, () => {
        drawer.close(false);
        go('checkout');
      });
    });
  }

  drawer = createDrawerController({
    doc: document,
    root: $('drawer-root'),
    panel,
    backdrop: $('drawer-backdrop'),
    closeButton: $('drawer-close'),
    opener,
    background: () => [$('site-header'), $('main')],
    onOpen: render,
  });
  const refresh = () => drawer.isOpen() && render();
  quote.subscribe(refresh);
  cart.subscribe(refresh);
  return drawer;
}
