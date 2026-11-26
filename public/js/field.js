import { h } from './dom.js';

// Labelled input/select with an inline error message wired through aria-describedby.
export function field({ id, label, type = 'text', options, wrap = '', ...attrs }) {
  const errId = `${id}-err`;
  const common = { id, name: id, 'aria-describedby': errId, ...attrs };
  const control =
    type === 'select'
      ? h(
          'select',
          common,
          h('option', { value: '', text: 'Select...' }),
          options.map(([value, text]) => h('option', { value, text })),
        )
      : h('input', { type, ...common });
  const error = h('p', { class: 'field-error', id: errId, text: '' });
  const node = h(
    'div',
    { class: `field-box ${wrap}`.trim() },
    h('label', { for: id, text: label }),
    control,
    error,
  );
  return {
    node,
    control,
    value: () => control.value,
    setValue(v) {
      control.value = v;
    },
    setError(message) {
      error.textContent = message || '';
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    },
  };
}

// Show errors on their fields and focus the first invalid one. Returns true when valid.
export function showErrors(fields, errors) {
  let first = null;
  for (const [name, f] of Object.entries(fields)) {
    f.setError(errors[name] || '');
    if (errors[name] && !first) first = f;
  }
  if (first) first.control.focus();
  return !first;
}
