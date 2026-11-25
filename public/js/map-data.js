// Pure helpers: turn GET /admin/regions data into per-country state and text.
import { money } from './money.js';

export function indexRegions(data) {
  const byRegion = new Map();
  for (const r of data.regions || []) byRegion.set(r.region, r.campaigns || []);
  return byRegion;
}

export function stateOf(campaigns) {
  if (!campaigns || campaigns.length === 0) return 'none';
  return campaigns.some((c) => c.activeNow) ? 'active' : 'inactive';
}

export function valueText(c) {
  return c.type === 'percentage' ? `${c.value}%` : money(c.value);
}

export function campaignLine(c) {
  return `${c.code} ${valueText(c)} (${c.activeNow ? 'active now' : 'inactive'})`;
}

export function summaryText(campaigns) {
  if (!campaigns || campaigns.length === 0) return 'No discounts';
  return campaigns.map(campaignLine).join('; ');
}

export function globalText(globals) {
  if (!globals || globals.length === 0) return 'Global campaigns apply everywhere: none.';
  return `Global campaigns apply everywhere: ${globals.map(campaignLine).join('; ')}.`;
}
