// Fetch wrapper. The JWT lives only in this module variable (never storage or cookies).
const BASE = '/api/v1';
let token = null;
let onSessionLost = () => {};

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const setToken = (value) => {
  token = value;
};
export const hasToken = () => token !== null;
export const setSessionLostHandler = (fn) => {
  onSessionLost = fn;
};

async function send(method, path, body) {
  const headers = { Accept: 'application/json, text/csv' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.');
  }
  if (res.ok) return res;
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const e = payload && payload.error ? payload.error : {};
  const retry = res.headers.get('Retry-After');
  let message = e.message || `Request failed (HTTP ${res.status})`;
  if (res.status === 429) {
    message = `Too many requests. ${retry ? `Retry in ${retry}s.` : 'Wait a moment and retry.'}`;
  }
  const err = new ApiError(
    res.status,
    e.code || (res.status === 429 ? 'RATE_LIMITED' : 'ERROR'),
    message,
    e.details,
  );
  const lost = ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'AUTH_REQUIRED'].includes(err.code);
  if (res.status === 401 && lost && token) {
    token = null;
    onSessionLost(err);
  }
  throw err;
}

export async function request(method, path, body) {
  const res = await send(method, path, body);
  const json = await res.json();
  return json.data;
}

// Authenticated download: fetch with bearer, then save through a Blob object URL.
export async function download(path, filename) {
  const res = await send('GET', path);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { describeError } from './errors.js';
