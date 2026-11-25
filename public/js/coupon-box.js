import { h, setBusy, setStatus } from './dom.js';
import { describeError } from './errors.js';

// Coupon field + Apply, or the green "reserved" chip with Remove. The server validates codes.
export function createCouponBox(quote) {
  const input = h('input', {
    id: 'coupon-code',
    name: 'code',
    type: 'text',
    maxlength: 64,
    autocomplete: 'off',
    'aria-describedby': 'coupon-status',
  });
  const apply = h('button', { type: 'submit', class: 'pill', text: 'Apply' });
  const status = h('p', { id: 'coupon-status', class: 'status', role: 'alert' });
  const chipText = h('span', { class: 'chip-text' });
  const remove = h('button', { type: 'button', class: 'link-btn', text: 'Remove' });
  const chip = h('div', { class: 'coupon-chip', hidden: true }, chipText, remove);
  const form = h(
    'form',
    {
      class: 'coupon-form',
      novalidate: true,
      onSubmit: async (e) => {
        e.preventDefault();
        const code = input.value.trim();
        if (apply.disabled) return;
        if (!code) return setStatus(status, 'Enter a coupon code.', 'error');
        setBusy(apply, true);
        setStatus(status, 'Checking...', 'info');
        try {
          await quote.apply(code);
          input.value = '';
          setStatus(status, '');
        } catch (err) {
          setStatus(status, describeError(err), 'error');
        } finally {
          setBusy(apply, false);
        }
      },
    },
    h('label', { for: 'coupon-code', text: 'Coupon code' }),
    h('div', { class: 'inline' }, input, apply),
  );

  remove.addEventListener('click', async () => {
    setBusy(remove, true);
    await quote.removeCoupon();
    setBusy(remove, false);
    setStatus(status, '');
    input.focus();
  });

  return {
    node: h('div', { class: 'coupon-box' }, form, chip, status),
    render(snap) {
      const held = snap.held;
      form.hidden = Boolean(held);
      chip.hidden = !held;
      if (held) {
        chipText.textContent = `${held.code} reserved for you`;
        remove.setAttribute('aria-label', `Remove coupon ${held.code}`);
        if (snap.error)
          setStatus(
            status,
            `Could not re-check your coupon: ${describeError(snap.error)}`,
            'error',
          );
        else if (status.textContent.startsWith('Could not re-check')) setStatus(status, '');
      }
    },
  };
}
