import { $, formatDate, h, money, renderTable, setBusy, setStatus } from './dom.js';
import { request, describeError } from './api.js';
import { csv, int, toIso } from './admin-form.js';
import { refreshMap } from './admin-map.js';
import { askConfirm } from './confirm.js';

const status = () => $('campaigns-status');

const valueText = (c) => (c.type === 'percentage' ? `${c.value}%` : money(c.value));

function regionsText(c) {
  const list = (c.conditions && c.conditions.regions) || [];
  return list.length ? list.join(', ') : 'Global';
}

export async function loadCampaigns() {
  setStatus(status(), 'Loading campaigns...', 'info');
  try {
    const rows = await request('GET', '/admin/campaigns');
    renderTable(
      $('campaigns-table'),
      [
        { label: 'Code', cell: (c) => c.code },
        { label: 'Name', cell: (c) => c.name },
        { label: 'Value', cell: (c) => valueText(c) },
        { label: 'Window', cell: (c) => `${formatDate(c.startsAt)} - ${formatDate(c.endsAt)}` },
        { label: 'Regions', cell: (c) => regionsText(c) },
        { label: 'Active', cell: (c) => (c.isActive ? 'Yes' : 'No') },
        {
          label: 'Action',
          cell: (c) =>
            h('button', {
              type: 'button',
              class: 'btn small secondary',
              'aria-label': `${c.isActive ? 'Deactivate' : 'Activate'} campaign ${c.code}`,
              text: c.isActive ? 'Deactivate' : 'Activate',
              onClick: (e) => guarded(c, e.currentTarget),
            }),
        },
      ],
      rows,
      'Campaigns',
    );
    setStatus(status(), '');
  } catch (err) {
    setStatus(status(), describeError(err), 'error');
  }
}

function guarded(c, button) {
  if (!c.isActive) return toggle(c, button);
  askConfirm(button, `Deactivate campaign ${c.code}?`, 'Deactivate', () => toggle(c, button));
}

async function toggle(c, button) {
  setBusy(button, true);
  try {
    await request('PATCH', `/admin/campaigns/${encodeURIComponent(c.code)}`, {
      isActive: !c.isActive,
    });
    await loadCampaigns();
    refreshMap();
  } catch (err) {
    setBusy(button, false);
    setStatus(status(), describeError(err), 'error');
  }
}

export function initCampaigns() {
  const form = $('campaign-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const regions = csv(f.regions.value);
    const body = {
      code: f.code.value.trim(),
      name: f.name.value.trim(),
      type: f.type.value,
      value: int(f.value.value),
      startsAt: toIso(f.startsAt.value),
      endsAt: toIso(f.endsAt.value),
      conditions: regions ? { regions } : {},
    };
    const btn = form.querySelector('button[type="submit"]');
    setBusy(btn, true);
    try {
      await request('POST', '/admin/campaigns', body);
      form.reset();
      await loadCampaigns();
      refreshMap();
      setStatus(status(), `Campaign ${body.code.toUpperCase()} created.`, 'ok');
    } catch (err) {
      setStatus(status(), describeError(err), 'error');
    } finally {
      setBusy(btn, false);
    }
  });
}
