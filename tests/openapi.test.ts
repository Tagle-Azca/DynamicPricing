import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './helpers/app';
import { registeredRoutes } from './helpers/routes';

const SPEC = readFileSync(join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8');
const API_PREFIX = '/api/v1';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** Reads "METHOD /path" pairs from the `paths:` block (2-space paths, 4-space methods). */
function specOperations(): string[] {
  const ops: string[] = [];
  let inPaths = false;
  let current = '';
  for (const line of SPEC.split('\n')) {
    if (/^\S/.test(line)) inPaths = line.startsWith('paths:');
    if (!inPaths) continue;
    const path = /^ {2}(\/\S*):\s*$/.exec(line);
    if (path?.[1]) current = path[1];
    const method = /^ {4}([a-z]+):\s*$/.exec(line);
    if (method?.[1] && METHODS.includes(method[1])) {
      ops.push(`${method[1].toUpperCase()} ${current}`);
    }
  }
  return ops;
}

/** Registered /api/v1 routes as "METHOD /relative/{param}" so they compare with the spec. */
function registeredOperations(): string[] {
  return registeredRoutes(buildApp())
    .map((r) => r.split(' ') as [string, string])
    .filter(([, path]) => path.startsWith(`${API_PREFIX}/`))
    .map(([method, path]) => {
      const rel = path.slice(API_PREFIX.length).replace(/:(\w+)/g, '{$1}');
      return `${method} ${rel.replace(/\/$/, '')}`;
    });
}

describe('docs/openapi.yaml', () => {
  it('declares OpenAPI 3.x, a bearer scheme and the /api/v1 server', () => {
    expect(SPEC).toMatch(/^openapi: 3\.\d+\.\d+$/m);
    expect(SPEC).toMatch(/bearerAuth:\s*\n\s+type: http\s*\n\s+scheme: bearer/);
    expect(SPEC).toContain(`url: ${API_PREFIX}`);
  });

  it('documents every registered /api/v1 route', () => {
    const documented = new Set(specOperations());
    const registered = registeredOperations();
    expect(registered.length).toBeGreaterThan(20);
    expect(registered.filter((r) => !documented.has(r))).toEqual([]);
  });

  it('does not document routes that no longer exist', () => {
    const registered = new Set(registeredOperations());
    expect(specOperations().filter((o) => !registered.has(o))).toEqual([]);
  });

  it('lists the error codes the API can return', () => {
    for (const code of [
      'UNKNOWN_SKU',
      'CURRENCY_MISMATCH',
      'COUPON_NOT_FOUND',
      'COUPON_UNAVAILABLE',
      'COUPON_EXHAUSTED',
      'COUPON_LIMIT_REACHED',
      'COUPON_ALREADY_APPLIED',
      'MIN_SUBTOTAL_NOT_MET',
      'AUDIT_NOT_FOUND',
      'RESERVATION_NOT_FOUND',
      'RESERVATION_NOT_ACTIVE',
      'PRODUCT_EXISTS',
      'PRODUCT_NOT_FOUND',
    ]) {
      expect(SPEC).toContain(code);
    }
  });
});
