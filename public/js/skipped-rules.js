import { h } from './dom.js';

// Plain-language labels for the server's skip reasons. Unknown reasons show the raw code.
const REASONS = {
  NON_STACKABLE_RULE_ALREADY_APPLIED: 'Cannot be combined with a discount already applied.',
  NON_STACKABLE_AFTER_OTHER_RULES: 'Cannot be combined with other discounts on this cart.',
  MIN_SUBTOTAL_NOT_MET: 'The cart subtotal is below the minimum for this discount.',
  CUSTOMER_TIER_NOT_ELIGIBLE: 'Not available for your customer tier.',
  REGION_NOT_ELIGIBLE: 'Not available in the selected region.',
  ZERO_DISCOUNT: 'It would not lower the price of this cart.',
  NOT_ELIGIBLE: 'The cart does not meet the conditions.',
};

export const reasonText = (reason) => REASONS[reason] || reason;

// Collapsed by default so the breakdown leads with the money figures.
export function skippedSection(rules) {
  if (!rules.length) return null;
  return h(
    'details',
    { class: 'skipped' },
    h('summary', { text: "Why weren't other discounts applied?" }),
    h(
      'ul',
      { class: 'list' },
      rules.map((s) =>
        h(
          'li',
          { class: 'item muted' },
          h('strong', { text: s.code }),
          h('span', { class: 'grow', text: reasonText(s.reason) }),
        ),
      ),
    ),
  );
}
