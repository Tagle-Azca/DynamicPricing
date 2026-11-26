import { $, formatDate, h, money, renderTable, setBusy, setStatus } from './dom.js';
import { request, describeError } from './api.js';
import { compact, int, toIso } from './admin-form.js';
import { askConfirm } from './confirm.js';

const status = () => $('coupons-status');

export async function loadCoupons() {
  setStatus(status(), 'Loading coupons...', 'info');
  try {
    const rows = await request('GET', '/admin/coupons');
    renderTable(
      $('coupons-table'),
      [
        { label: 'Code', cell: (c) => c.code },
        {
          label: 'Discount',
          cell: (c) => (c.discountType === 'percentage' ? `${c.value}%` : money(c.value)),
        },
        { label: 'Uses left', cell: (c) => `${c.remainingUses} / ${c.maxUses}` },
        { label: 'Per user', cell: (c) => String(c.perUserLimit ?? 1) },
        { label: 'Expires', cell: (c) => formatDate(c.expiresAt) },
        { label: 'User', cell: (c) => c.userId || 'any' },
        { label: 'Active', cell: (c) => (c.isActive ? 'Yes' : 'No') },
        {
          label: 'Action',
          cell: (c) =>
            h('button', {
              type: 'button',
              class: 'btn small secondary',
              'aria-label': `${c.isActive ? 'Deactivate' : 'Activate'} coupon ${c.code}`,
              text: c.isActive ? 'Deactivate' : 'Activate',
              onClick: (e) => guarded(c, e.currentTarget),
            }),
        },
      ],
      rows,
      'Coupons',
    );
    setStatus(status(), '');
  } catch (err) {
    setStatus(status(), describeError(err), 'error');
  }
}

function guarded(c, button) {
  if (!c.isActive) return toggle(c, button);
  askConfirm(button, `Deactivate coupon ${c.code}?`, 'Deactivate', () => toggle(c, button));
}

async function toggle(c, button) {
  setBusy(button, true);
  try {
    await request('PATCH', `/admin/coupons/${encodeURIComponent(c.code)}`, {
      isActive: !c.isActive,
    });
    await loadCoupons();
  } catch (err) {
    setBusy(button, false);
    setStatus(status(), describeError(err), 'error');
  }
}

export function initCoupons() {
  const form = $('coupon-create-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const body = compact({
      code: f.code.value.trim(),
      discountType: f.discountType.value,
      value: int(f.value.value),
      maxUses: int(f.maxUses.value),
      perUserLimit: int(f.perUserLimit.value),
      expiresAt: toIso(f.expiresAt.value),
      userId: f.userId.value.trim() || undefined,
    });
    const btn = form.querySelector('button[type="submit"]');
    setBusy(btn, true);
    try {
      await request('POST', '/admin/coupons', body);
      form.reset();
      await loadCoupons();
      setStatus(status(), `Coupon ${body.code.toUpperCase()} created.`, 'ok');
    } catch (err) {
      setStatus(status(), describeError(err), 'error');
    } finally {
      setBusy(btn, false);
    }
  });
}
