// Tooltip shown on hover and keyboard focus. Text only (textContent).
import { h, clear } from './dom.js';
import { campaignLine } from './map-data.js';

export function createTooltip(node) {
  return {
    show(name, campaigns) {
      clear(node);
      node.append(h('strong', { text: name }));
      if (!campaigns || campaigns.length === 0) {
        node.append(h('div', { text: 'No discounts' }));
      } else {
        for (const c of campaigns) node.append(h('div', { text: campaignLine(c) }));
      }
      node.hidden = false;
    },
    hide() {
      node.hidden = true;
      clear(node);
    },
  };
}
