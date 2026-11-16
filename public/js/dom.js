// Small DOM helpers. Text is always set via textContent, never as HTML.
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = String(value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (id) => document.getElementById(id);

export function clear(node) {
  node.replaceChildren();
}

export function setStatus(node, message, kind = 'info') {
  node.textContent = message || '';
  node.dataset.kind = message ? kind : '';
}

export function setBusy(button, busy) {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

export function money(cents) {
  return (Number(cents) / 100).toFixed(2);
}

export function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value ?? '') : d.toLocaleString();
}

// columns: [{ label, cell(row) -> Node | string }]
export function renderTable(table, columns, rows, caption) {
  clear(table);
  table.append(h('caption', { class: 'sr-only', text: caption }));
  table.append(
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        columns.map((c) => h('th', { scope: 'col', text: c.label })),
      ),
    ),
  );
  const body = h('tbody');
  if (rows.length === 0) {
    body.append(
      h('tr', {}, h('td', { colspan: columns.length, class: 'muted', text: 'No records.' })),
    );
  }
  for (const row of rows) {
    body.append(
      h(
        'tr',
        {},
        columns.map((c) => h('td', {}, c.cell(row))),
      ),
    );
  }
  table.append(body);
}
