import { h } from './dom.js';

// Campaign progress strip. `state` comes from progressState(); width is the server percent.
export function progressView(state, label) {
  if (state.kind === 'plain') return null;
  const fill = h('span', { class: `bar-fill${state.kind === 'unlocked' ? ' done' : ''}` });
  fill.style.width = `${state.percent}%`;
  return h(
    'div',
    { class: 'progress' },
    h(
      'div',
      {
        class: 'bar',
        role: 'progressbar',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': state.percent,
      },
      fill,
    ),
    h('p', { class: 'progress-text', text: state.text }),
  );
}
