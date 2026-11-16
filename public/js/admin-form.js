// Shared helpers for admin forms.
export const toIso = (v) => (v ? new Date(v).toISOString() : undefined);

export function csv(v) {
  const list = String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export function int(v) {
  return v === '' || v === null || v === undefined ? undefined : Number(v);
}

export function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}
