import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { buildApp } from './helpers/app';

const app = buildApp();
const PUBLIC = join(__dirname, '..', 'public');
const read = (file: string): string => readFileSync(join(PUBLIC, file), 'utf8');

describe('static UI', () => {
  it('serves index.html at / with a CSP that has no unsafe-eval', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    const csp = String(res.headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
  });

  it('serves the JavaScript and CSS assets', async () => {
    const js = await request(app).get('/js/main.js');
    expect(js.status).toBe(200);
    expect(js.headers['content-type']).toMatch(/javascript/);
    expect((await request(app).get('/styles.css')).status).toBe(200);
  });

  it('keeps the JSON 404 for unknown API paths and /health', async () => {
    const miss = await request(app).get('/api/v1/nope');
    expect(miss.status).toBe(404);
    expect(miss.headers['content-type']).toContain('application/json');
    expect((await request(app).get('/health')).body.data).toBeDefined();
  });

  it('serves the new modules and the admin products section', async () => {
    for (const file of ['catalog.js', 'errors.js', 'admin-products.js', 'price-view.js']) {
      expect((await request(app).get(`/js/${file}`)).status).toBe(200);
    }
    const html = read('index.html');
    for (const id of ['products-table', 'product-create-form', 'catalog-status', 'coupon-status']) {
      expect(html).toContain(`id="${id}"`);
    }
  });
});

describe('UI contract', () => {
  const js = readdirSync(join(PUBLIC, 'js')).filter((f) => f.endsWith('.js'));

  it('has no hardcoded catalog and reads products from /catalog', () => {
    expect(read('js/catalog.js')).toContain("request('GET', '/catalog')");
    for (const file of js) expect(read(`js/${file}`)).not.toContain('SKU-LAPTOP');
  });

  it('sends only sku and quantity per cart item, plus an optional coupon code', () => {
    const cart = read('js/cart.js');
    expect(cart).toContain('({ sku, quantity })');
    expect(cart).toContain('couponCode');
    expect(cart).not.toMatch(/unitPrice|category/);
  });

  it('uses the new coupon flow without a client-side subtotal', () => {
    const coupon = read('js/coupon.js');
    expect(coupon).not.toContain('/coupons/apply');
    expect(coupon).not.toContain('subtotal');
    expect(coupon).toContain('/coupons/reservations/');
  });

  it('renders totals from the server response only', () => {
    const view = read('js/price-view.js');
    for (const field of ['r.subtotal', 'r.totalDiscount', 'r.total', 'r.finalTotal']) {
      expect(view).toContain(field);
    }
    expect(view).not.toMatch(/r\.total\s*-|finalTotal\s*=|subtotal\s*[-+]/);
  });

  it('has distinct messages for 401, 409, 422 and 429', () => {
    const errors = read('js/errors.js');
    for (const text of ['401', '409', '422', '429', 'UNKNOWN_SKU', 'MIN_SUBTOTAL_NOT_MET']) {
      expect(errors).toContain(text);
    }
    expect(read('js/api.js')).toContain('Retry in');
  });

  it('keeps the strict CSP rules: no HTML sinks, storage, or inline scripts', () => {
    for (const file of js) {
      const src = read(`js/${file}`);
      expect(src).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/);
      expect(src).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    }
    expect(read('index.html')).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(read('index.html')).not.toMatch(/\sstyle=|\son[a-z]+=/);
  });
});
