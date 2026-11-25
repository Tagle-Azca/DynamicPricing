import { $, appendAll, clear, h } from './dom.js';
import { offerText, progressState } from './campaigns.js';
import { progressView } from './progress-view.js';

// Dark campaign banner on the shop page. Hidden when there is no active campaign.
export function initBanner(cart, quote, campaignRef) {
  const box = $('banner');

  function render() {
    const campaign = campaignRef.current;
    box.hidden = !campaign;
    clear(box);
    if (!campaign) return;
    const state = progressState(campaign, quote.snapshot(), cart.isEmpty());
    appendAll(
      box,
      h('p', { class: 'banner-label', text: 'Live campaign' }),
      h('h2', { class: 'banner-title', text: offerText(campaign) }),
      h('p', { class: 'banner-note', text: 'Applies automatically at checkout, no code needed.' }),
      progressView(state, `Progress toward ${campaign.code}`),
    );
  }

  quote.subscribe(render);
  return { render };
}
