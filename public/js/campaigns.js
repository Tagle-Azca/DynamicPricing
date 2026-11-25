import { request } from './api.js';
import { formatMoney } from './money.js';

// Active campaign for the banner (GET /campaigns/active). Prefers one with a minimum subtotal.
export async function loadBannerCampaign() {
  try {
    const data = await request('GET', '/campaigns/active');
    const list = Array.isArray(data) ? data : (data && data.campaigns) || [];
    return list.find((c) => c.minSubtotal) || list[0] || null;
  } catch {
    return null; // the banner is optional: a failure hides it
  }
}

export function offerText(c) {
  const off =
    c.type === 'percentage' ? `${c.value}% off` : `${formatMoney(c.value, { compact: true })} off`;
  return c.minSubtotal ? `${off} carts over ${formatMoney(c.minSubtotal, { compact: true })}` : off;
}

// What the progress strip shows, read from the server quote only.
export function progressState(campaign, snap, cartEmpty) {
  const none = { kind: 'plain' };
  const quote = snap && snap.data;
  if (!campaign || !campaign.minSubtotal || cartEmpty || !quote) return none;
  if ((quote.appliedRules || []).some((r) => r.code === campaign.code)) {
    return { kind: 'unlocked', percent: 100, text: `${campaign.code} unlocked` };
  }
  const next = quote.nextThreshold;
  if (next && next.code === campaign.code) {
    const off = campaign.type === 'percentage' ? `${campaign.value}% off` : 'your discount';
    return {
      kind: 'progress',
      percent: next.progressPercent,
      text: `Add ${formatMoney(next.remaining, { currency: quote.currency })} more to unlock ${off}`,
    };
  }
  return none;
}
