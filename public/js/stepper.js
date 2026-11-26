import { h } from './dom.js';
import { icon } from './icons.js';

// - / qty / + control. Quantities are plain integers; amounts never pass through here.
export function stepper(name, qty, { onDec, onInc }, key) {
  return h(
    'div',
    { class: 'stepper', role: 'group', 'aria-label': `Quantity of ${name}` },
    h(
      'button',
      {
        type: 'button',
        class: 'step-btn',
        'data-focus-key': `${key}:dec`,
        'aria-label': `Decrease quantity of ${name}`,
        onClick: onDec,
      },
      icon('minus', 16),
    ),
    h('output', { class: 'step-qty', 'aria-live': 'polite', text: qty }),
    h(
      'button',
      {
        type: 'button',
        class: 'step-btn',
        'data-focus-key': `${key}:inc`,
        'aria-label': `Increase quantity of ${name}`,
        onClick: onInc,
      },
      icon('plus', 16),
    ),
  );
}
