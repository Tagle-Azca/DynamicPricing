import { $, formatDate, h, money, renderTable, setBusy, setStatus } from './dom.js';
import { download, request, describeError } from './api.js';

const status = () => $('audits-status');

async function verify(audit, cell, button) {
  setBusy(button, true);
  cell.textContent = 'Verifying...';
  try {
    const r = await request('GET', `/admin/audits/${encodeURIComponent(audit.auditId)}`);
    cell.textContent = r.checksumValid ? 'checksumValid: true' : 'checksumValid: FALSE (tampered)';
    cell.dataset.kind = r.checksumValid ? 'ok' : 'error';
  } catch (err) {
    cell.textContent = describeError(err);
    cell.dataset.kind = 'error';
  } finally {
    setBusy(button, false);
  }
}

export async function loadAudits() {
  setStatus(status(), 'Loading audits...', 'info');
  try {
    const rows = await request('GET', '/admin/audits?limit=50');
    renderTable(
      $('audits-table'),
      [
        { label: 'Created', cell: (a) => formatDate(a.createdAt) },
        { label: 'Audit id', cell: (a) => h('code', { text: a.auditId }) },
        { label: 'Cart', cell: (a) => a.cartId },
        { label: 'User', cell: (a) => (a.context && a.context.userId) || '' },
        { label: 'Total', cell: (a) => money(a.result.total) },
        {
          label: 'Verify',
          cell: (a) => {
            const out = h('span', { class: 'verify', role: 'status' });
            const btn = h('button', {
              type: 'button',
              class: 'btn small secondary',
              'aria-label': `Verify audit ${a.auditId}`,
              text: 'Verify',
              onClick: (e) => verify(a, out, e.currentTarget),
            });
            return [btn, ' ', out];
          },
        },
      ],
      rows,
      'Latest audits',
    );
    setStatus(status(), '');
  } catch (err) {
    setStatus(status(), describeError(err), 'error');
  }
}

async function exportAs(format, button) {
  setBusy(button, true);
  setStatus(status(), `Preparing ${format.toUpperCase()} export...`, 'info');
  try {
    await download(`/admin/audits/export?format=${format}`, `audits.${format}`);
    setStatus(status(), `Export ready: audits.${format}`, 'ok');
  } catch (err) {
    setStatus(status(), describeError(err), 'error');
  } finally {
    setBusy(button, false);
  }
}

export function initAudits() {
  $('export-json').addEventListener('click', (e) => exportAs('json', e.currentTarget));
  $('export-csv').addEventListener('click', (e) => exportAs('csv', e.currentTarget));
}
