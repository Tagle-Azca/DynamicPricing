import { h } from './dom.js';
import { icon } from './icons.js';

// One accordion step: numbered badge, title, one-line summary + Edit when complete.
// The body is built once and only hidden, so typed values and focus survive step changes.
export function stepCard(number, title, body, onEdit) {
  const badge = h('span', { class: 'step-badge' });
  const summary = h('p', { class: 'step-summary' });
  const edit = h('button', {
    type: 'button',
    class: 'pill small',
    'aria-label': `Edit ${title}`,
    onClick: onEdit,
    text: 'Edit',
  });
  const head = h(
    'div',
    { class: 'step-head' },
    badge,
    h('div', { class: 'step-title' }, h('h2', { text: title }), summary),
    edit,
  );
  const node = h('section', { class: 'step', 'aria-label': title }, head, body);
  return {
    node,
    // state: 'active' | 'done' | 'upcoming'
    update(state, text = '') {
      node.dataset.state = state;
      badge.replaceChildren(state === 'done' ? icon('check', 16) : String(number));
      summary.textContent = state === 'done' ? text : '';
      summary.hidden = state !== 'done';
      edit.hidden = state !== 'done';
      body.hidden = state !== 'active';
      if (state === 'active') node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    },
  };
}
