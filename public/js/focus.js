// Re-rendering replaces buttons; keep keyboard focus on the same control (or its sibling).
// Controls opt in with data-focus-key="<group>:<action>".
export function keepFocus(container, rebuild) {
  const active = document.activeElement;
  const key = container.contains(active) && active.dataset ? active.dataset.focusKey : null;
  rebuild();
  if (!key) return;
  const group = key.slice(0, key.lastIndexOf(':') + 1);
  const pick = (k) =>
    [...container.querySelectorAll('[data-focus-key]')].find((n) => k(n.dataset.focusKey));
  const next = pick((k) => k === key) || pick((k) => k.startsWith(group));
  if (next) next.focus();
}

// Tab trap: given the focusable elements of a dialog, the element that should receive focus
// when Tab (or Shift+Tab) is pressed on `active`, or null to let the browser move normally.
export function nextTrapTarget(focusable, active, shift) {
  if (focusable.length === 0) return null;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (shift && (active === first || !focusable.includes(active))) return last;
  if (!shift && (active === last || !focusable.includes(active))) return first;
  return null;
}
