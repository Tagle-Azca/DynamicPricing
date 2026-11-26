// Small edit panel for one country: add or remove it on a chosen campaign.
import { h, clear, setBusy, setStatus } from './dom.js';
import { request, describeError, ApiError } from './api.js';
import { askConfirm } from './confirm.js';

const regionsOf = (c) => (c.conditions && c.conditions.regions) || [];

function friendly(err) {
  if (err instanceof ApiError && err.code === 'LAST_REGION') {
    return 'This is the last region of the campaign. Deactivate the campaign instead.';
  }
  return describeError(err);
}

export function createPanel(node, { onChanged, onClose }) {
  let seq = 0;
  let code = null;
  let campaigns = [];
  let loaded = false;
  let chosen = '';

  const path = (campaign) =>
    `/admin/campaigns/${encodeURIComponent(campaign)}/regions/${encodeURIComponent(code)}`;

  async function fetchCampaigns() {
    const mine = ++seq;
    const rows = await request('GET', '/admin/campaigns');
    return mine === seq ? rows : null; // ignore stale responses
  }

  function render(name) {
    clear(node);
    const heading = h('h3', { class: 'panel-title', tabindex: '-1', text: `${name} (${code})` });
    const select = h('select', { id: 'panel-campaign', name: 'campaign' });
    for (const c of campaigns)
      select.append(h('option', { value: c.code, text: `${c.code} - ${c.name}` }));
    select.value = chosen;
    const note = h('p', { class: 'hint' });
    const status = h('p', { class: 'status', role: 'alert' });
    const action = h('button', { type: 'button', class: 'btn' });
    const selected = () => campaigns.find((c) => c.code === select.value);
    const has = () => regionsOf(selected() || {}).includes(code);

    function sync() {
      const c = selected();
      action.disabled = !c;
      action.textContent = has() ? `Remove from ${code}` : `Add to ${code}`;
      note.textContent =
        c && regionsOf(c).length === 0 && !has()
          ? `${c.code} is global. Adding ${code} limits it to that country only.`
          : '';
    }
    select.addEventListener('change', () => {
      chosen = select.value;
      setStatus(status, '');
      sync();
    });
    action.addEventListener('click', () => {
      const c = selected();
      if (!c) return;
      if (!has()) return save(c, 'PUT');
      askConfirm(action, `Remove ${code} from campaign ${c.code}?`, 'Remove', () =>
        save(c, 'DELETE'),
      );
    });
    async function save(c, method) {
      setBusy(action, true);
      setStatus(status, 'Saving...', 'info');
      try {
        await request(method, path(c.code));
        const rows = await fetchCampaigns();
        if (rows) campaigns = rows;
        render(name);
        const done = h('p', { class: 'status', role: 'status', 'data-kind': 'ok' });
        done.textContent = `${c.code} updated for ${code}.`;
        node.append(done);
        onChanged();
      } catch (err) {
        setBusy(action, false);
        setStatus(status, friendly(err), 'error');
      }
    }
    const close = h('button', {
      type: 'button',
      class: 'btn small secondary',
      text: 'Close',
      onClick: () => api.close(),
    });
    let body;
    if (!loaded) body = [h('p', { class: 'muted', text: 'Loading campaigns...' })];
    else if (campaigns.length === 0) {
      body = [h('p', { class: 'muted', text: 'No campaigns yet. Create one below.' })];
    } else body = [h('label', { for: 'panel-campaign', text: 'Campaign' }), select, note, action];
    node.append(h('div', { class: 'panel-head' }, heading, close), ...body, status);
    sync();
    return heading;
  }

  const api = {
    async open(newCode, name) {
      code = newCode;
      campaigns = [];
      loaded = false;
      chosen = '';
      node.hidden = false;
      render(name).focus();
      try {
        const rows = await fetchCampaigns();
        if (rows && code === newCode) {
          campaigns = rows;
          loaded = true;
          render(name);
        }
      } catch (err) {
        node.append(h('p', { class: 'status', 'data-kind': 'error', text: describeError(err) }));
      }
    },
    close() {
      seq++;
      code = null;
      node.hidden = true;
      clear(node);
      onClose();
    },
    clear() {
      seq++;
      code = null;
      node.hidden = true;
      clear(node);
    },
  };
  return api;
}
