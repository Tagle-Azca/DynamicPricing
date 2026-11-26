import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    for (const file of [
      'catalog.js',
      'errors.js',
      'admin-products.js',
      'skipped-rules.js',
      'money.js',
      'drawer.js',
      'checkout.js',
      'confirm.js',
      'admin-tabs.js',
      'admin-create.js',
    ]) {
      expect((await request(app).get(`/js/${file}`)).status).toBe(200);
    }
    const html = read('index.html');
    for (const id of ['products-table', 'product-create-form', 'catalog-status', 'drawer']) {
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
    const cart = read('js/cart-store.js');
    expect(cart).toContain('({ sku, quantity })');
    expect(cart).toContain('couponCode');
    expect(cart).not.toMatch(/unitPrice|category/);
  });

  it('uses the coupon flow without a client-side subtotal', () => {
    const quote = read('js/quote.js');
    expect(quote).not.toContain('/coupons/apply');
    expect(quote).toContain('/coupons/reservations/');
    expect(read('js/coupon-box.js')).not.toContain('subtotal');
  });

  it('renders totals from the server response only', () => {
    const view = read('js/order-summary.js');
    for (const field of ['q.subtotal', 'q.grandTotal', 'q.finalTotal', 'q.savings', 'r.discount']) {
      expect(view).toContain(field);
    }
    expect(view).not.toMatch(/q\.total\s*-|finalTotal\s*=[^=]|subtotal\s*[-+*]/);
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

describe('UI polish', () => {
  const html = read('index.html');
  const js = readdirSync(join(PUBLIC, 'js')).filter((f) => f.endsWith('.js'));

  it('[DoD-1] labels skipped rules in plain language inside a collapsed section', () => {
    const src = read('js/skipped-rules.js');
    for (const code of [
      'NON_STACKABLE_RULE_ALREADY_APPLIED',
      'MIN_SUBTOTAL_NOT_MET',
      'CUSTOMER_TIER_NOT_ELIGIBLE',
      'REGION_NOT_ELIGIBLE',
    ]) {
      expect(src).toContain(code);
    }
    expect(src).toContain("Why weren't other discounts applied?");
    expect(src).toContain('REASONS[reason] || reason');
    expect(src).not.toMatch(/\bopen\b/);
  });

  it('[DoD-2] splits admin into four accessible tabs with matching panels', () => {
    expect(html).toContain('role="tablist"');
    for (const name of ['map', 'coupons', 'products', 'audits']) {
      expect(html).toContain(`id="subtab-${name}"`);
      expect(html).toMatch(new RegExp(`id="panel-${name}"\\s+role="tabpanel"`));
    }
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(read('js/admin-tabs.js')).toContain('ArrowRight');
    expect(read('js/admin-boot.js')).toContain('initAdminTabs()');
  });

  it('[DoD-3] opens create forms from visible "+ New" buttons', () => {
    for (const label of ['campaign', 'coupon', 'product']) {
      expect(html).toContain(`+ New ${label}`);
    }
    expect(html.match(/data-create-toggle/g)).toHaveLength(3);
    expect(html).not.toContain('<summary>New');
    expect(read('js/admin-create.js')).toContain("'reset'");
  });

  it('[DoD-4] confirms deactivation and region removal in-page', () => {
    expect(read('js/confirm.js')).not.toContain('window.confirm');
    for (const file of ['admin-campaigns', 'admin-coupons', 'admin-products', 'map-panel']) {
      expect(read(`js/${file}.js`)).toContain('askConfirm(');
    }
    for (const file of js) expect(read(`js/${file}`)).not.toMatch(/\bconfirm\(/);
  });

  it('[DoD-6] disables buttons and shows a busy label while a request runs', () => {
    expect(read('js/dom.js')).toContain('busyLabel');
    expect(html.match(/data-busy-label/g)!.length).toBeGreaterThanOrEqual(5);
    expect(read('js/coupon-box.js')).toContain('setBusy(apply');
    expect(read('js/auth.js')).toContain('buttons[0].disabled');
  });

  it('[DoD-7] keeps admin tables in their own scroll container', () => {
    const css = read('styles.css');
    expect(css).toMatch(/\.table-wrap\s*{\s*overflow-x: auto/);
    expect(css).toMatch(/\.subtabs\s*{[^}]*overflow-x: auto/);
  });
});

// ---------------------------------------------------------------------------------------
// Behavior of the redesign. Modules are plain ES modules; the DOM-free ones are imported
// directly, with a stubbed fetch where they call the API.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mod = any;
const load = (file: string): Promise<Mod> => import(/* @vite-ignore */ join(PUBLIC, 'js', file));

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
}

// Fake fetch: records calls and answers with the handler's { status, data } (default 200).
function stubApi(handler: (c: Call) => { status?: number; data?: unknown; code?: string }): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: { method: string; body?: string }) => {
      const call = {
        method: init.method,
        path: String(url).replace('/api/v1', ''),
        body: init.body ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      const r = handler(call);
      const status = r.status ?? 200;
      return {
        ok: status < 400,
        status,
        headers: { get: () => null },
        json: async () =>
          status < 400
            ? { data: r.data }
            : { error: { code: r.code ?? 'ERROR', message: 'Rejected by the server.' } },
      };
    }),
  );
  return calls;
}

const quoteReply = (extra: Record<string, unknown> = {}) => ({
  auditId: 'a1',
  currency: 'USD',
  subtotal: 100000,
  appliedRules: [],
  skippedRules: [],
  items: [],
  ...extra,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('[DoD-12] money and server-only amounts', () => {
  const js = readdirSync(join(PUBLIC, 'js')).filter((f) => f.endsWith('.js'));

  it('formats cents only in money.js and nowhere else divides or multiplies by 100', async () => {
    const { formatMoney } = await load('money.js');
    expect(formatMoney(121000)).toBe('$1,210.00');
    expect(formatMoney(100000, { compact: true })).toBe('$1,000');
    expect(formatMoney(499)).toBe('$4.99');
    for (const file of js.filter((f) => f !== 'money.js')) {
      expect(read(`js/${file}`), file).not.toMatch(/\/\s*100\b|\*\s*100\b|toFixed\(/);
    }
  });

  it('never adds or subtracts server amounts in the checkout and drawer views', () => {
    const files = [
      'drawer-view.js',
      'drawer-footer.js',
      'order-summary.js',
      'checkout.js',
      'confirmation.js',
      'step-delivery.js',
    ];
    for (const file of files) {
      expect(read(`js/${file}`), file).not.toMatch(
        /(subtotal|total|Total|discount|amount|savings|remaining)\s*[-+*]\s*[\w(]/,
      );
    }
    expect(read('js/campaigns.js')).toContain('next.progressPercent');
    expect(read('js/campaigns.js')).toContain('next.remaining');
  });

  it('keeps card data out of every request and out of the order body', () => {
    const checkout = read('js/checkout.js');
    const body = checkout.slice(
      checkout.indexOf("'/orders'"),
      checkout.indexOf('confirmed = true'),
    );
    expect(body).toContain('auditId');
    expect(body).not.toMatch(/number|expiry|cvc|cardName|card/i);
    expect(read('js/step-payment.js')).toContain('Demo only: no card is charged');
    for (const file of js.filter((f) => f !== 'step-payment.js' && f !== 'validate.js')) {
      expect(read(`js/${file}`), file).not.toMatch(/pay-number|cvc/);
    }
  });

  it('builds images with alt, lazy loading and no referrer, and a CSS placeholder otherwise', () => {
    const thumb = read('js/thumb.js');
    for (const attr of [
      'alt:',
      "loading: 'lazy'",
      "decoding: 'async'",
      "referrerpolicy: 'no-referrer'",
    ]) {
      expect(thumb).toContain(attr);
    }
    expect(thumb).toContain('thumb-empty');
    expect(read('index.html')).not.toMatch(/<img/);
  });

  it('removes the tier and region dropdowns from the cart and keeps admin dark styles scoped', () => {
    const html = read('index.html');
    expect(html).not.toMatch(/id="(tier|region)"/);
    expect(read('js/step-contact.js')).toContain('cart.setRegion');
    expect(read('styles.css')).toContain('body.admin-mode {');
    expect(read('styles.css')).not.toMatch(/^:root/m);
    expect(read('theme.css')).toContain('--bg: #f6f6f3');
    expect(html).toContain('id="p-image"');
    expect(read('js/admin-products.js')).toContain('imageUrl');
  });

  it('self-hosts the fonts', () => {
    const css = read('theme.css');
    expect(css).toContain('/fonts/inter-latin.woff2');
    expect(css).toContain('/fonts/space-grotesk-latin.woff2');
    for (const file of ['theme.css', 'styles.css', 'shop.css', 'checkout.css']) {
      expect(read(file)).not.toMatch(/https?:\/\//);
    }
  });
});

describe('[DoD-9] shop page', () => {
  it('has the sticky header, banner, chips and responsive grid', () => {
    const html = read('index.html');
    for (const id of [
      'site-header',
      'cart-btn',
      'cart-count',
      'banner',
      'chips',
      'catalog',
      'product-count',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    const css = read('shop.css');
    expect(css).toContain('repeat(auto-fill, minmax(260px, 1fr))');
    expect(css).toMatch(/\.site-header\s*{[^}]*position: sticky/);
    expect(css).toContain('backdrop-filter: blur');
    expect(css).toContain('aspect-ratio: 4 / 3');
    expect(read('js/product-card.js')).toContain('in cart');
    expect(read('js/product-card.js')).toContain('Add to cart');
  });

  it('banner progress comes from the server fields', async () => {
    const { progressState, offerText } = await load('campaigns.js');
    const mega = { code: 'MEGA25', type: 'percentage', value: 25, minSubtotal: 100000 };
    expect(offerText(mega)).toBe('25% off carts over $1,000');
    expect(progressState(mega, { data: null }, true)).toEqual({ kind: 'plain' });
    expect(
      progressState({ code: 'X', type: 'percentage', value: 5 }, { data: quoteReply() }, false)
        .kind,
    ).toBe('plain');
    const near = quoteReply({
      nextThreshold: { code: 'MEGA25', remaining: 5000, progressPercent: 95 },
    });
    expect(progressState(mega, { data: near }, false)).toEqual({
      kind: 'progress',
      percent: 95,
      text: 'Add $50.00 more to unlock 25% off',
    });
    const done = quoteReply({ appliedRules: [{ code: 'MEGA25' }] });
    expect(progressState(mega, { data: done }, false)).toEqual({
      kind: 'unlocked',
      percent: 100,
      text: 'MEGA25 unlocked',
    });
  });

  it('hides the banner when there is no campaign', async () => {
    const { loadBannerCampaign } = await load('campaigns.js');
    stubApi(() => ({ data: { campaigns: [] } }));
    expect(await loadBannerCampaign()).toBeNull();
    stubApi(() => ({
      data: {
        campaigns: [
          { code: 'A', value: 5 },
          { code: 'B', value: 4, minSubtotal: 100 },
        ],
      },
    }));
    expect((await loadBannerCampaign())?.code).toBe('B');
  });
});

describe('[DoD-10] cart drawer', () => {
  // Minimal fakes for the nodes the controller touches.
  const classes = () => {
    const set = new Set<string>();
    return {
      add: (c: string) => set.add(c),
      remove: (c: string) => set.delete(c),
      contains: (c: string) => set.has(c),
    };
  };
  function setup() {
    const handlers: Record<string, (e: unknown) => void> = {};
    const node = (name: string) => {
      const attrs: Record<string, string> = {};
      return {
        name,
        inert: false,
        attrs,
        focused: 0,
        classList: classes(),
        setAttribute: (k: string, v: string) => (attrs[k] = v),
        addEventListener: (type: string, fn: (e: unknown) => void) =>
          (handlers[`${name}:${type}`] = fn),
        focus() {
          doc.activeElement = this;
          this.focused += 1;
        },
      };
    };
    const doc = {
      activeElement: null as unknown,
      body: { classList: classes() },
      addEventListener: (type: string, fn: (e: unknown) => void) => (handlers[`doc:${type}`] = fn),
    };
    const root = node('root');
    const backdrop = node('backdrop');
    const closeButton = node('close');
    const opener = node('opener');
    const a = node('a');
    const b = node('b');
    const panel = { querySelectorAll: () => [closeButton, a, b] };
    const background = [node('header'), node('main')];
    const fire = (name: string, e: unknown = {}) => handlers[name]?.(e);
    return { doc, root, backdrop, closeButton, opener, panel, a, b, background, fire };
  }

  async function build() {
    const { createDrawerController } = await load('drawer-controller.js');
    const t = setup();
    let renders = 0;
    const drawer = createDrawerController({
      ...t,
      background: () => t.background,
      onOpen: () => (renders += 1),
    });
    t.opener.focus();
    const key = (k: string, shiftKey = false) => {
      const e = {
        key: k,
        shiftKey,
        prevented: false,
        preventDefault() {
          this.prevented = true;
        },
      };
      t.fire('doc:keydown', e);
      return e;
    };
    return { ...t, drawer, key, renders: () => renders };
  }

  it('opens from the cart button: renders, locks scroll, makes the page inert, focuses X', async () => {
    const t = await build();
    t.fire('opener:click');
    expect(t.drawer.isOpen()).toBe(true);
    expect(t.renders()).toBe(1);
    expect(t.root.attrs['aria-hidden']).toBe('false');
    expect(t.doc.body.classList.contains('lock')).toBe(true);
    expect(t.background.every((n) => n.inert)).toBe(true);
    expect(t.doc.activeElement).toBe(t.closeButton);
  });

  it.each([
    ['the X button', (t: Awaited<ReturnType<typeof build>>) => t.fire('close:click')],
    ['the backdrop', (t: Awaited<ReturnType<typeof build>>) => t.fire('backdrop:click')],
    ['Esc', (t: Awaited<ReturnType<typeof build>>) => t.key('Escape')],
  ])('closes with %s and restores focus to the opener', async (_name, close) => {
    const t = await build();
    t.fire('opener:click');
    close(t);
    expect(t.drawer.isOpen()).toBe(false);
    expect(t.doc.body.classList.contains('lock')).toBe(false);
    expect(t.background.every((n) => !n.inert)).toBe(true);
    expect(t.doc.activeElement).toBe(t.opener);
  });

  it('traps Tab inside the drawer in both directions', async () => {
    const t = await build();
    t.fire('opener:click');
    t.b.focus();
    expect(t.key('Tab').prevented).toBe(true);
    expect(t.doc.activeElement).toBe(t.closeButton);
    expect(t.key('Tab', true).prevented).toBe(true);
    expect(t.doc.activeElement).toBe(t.b);
    t.a.focus();
    expect(t.key('Tab').prevented).toBe(false);
  });

  it('ignores Esc when closed and declares the dialog semantics in the page', async () => {
    const t = await build();
    expect(t.key('Escape').prevented).toBe(false);
    const html = read('index.html');
    expect(html).toMatch(/id="drawer"[^>]*role="dialog"[^>]*aria-modal="true"/s);
    expect(html).toContain('aria-labelledby="drawer-title"');
    const css = read('shop.css');
    expect(css).toMatch(/width: min\(440px, 100%\)/);
    expect(css).toContain('prefers-reduced-motion: no-preference');
    const view = read('js/drawer-view.js') + read('js/drawer-footer.js');
    for (const text of [
      'Browse products',
      'Go to checkout',
      'Remove',
      'Campaign discount',
      'Coupons and shipping are added on the checkout page.',
    ]) {
      expect(view).toContain(text);
    }
  });

  it('navigates to #/checkout from the footer button', () => {
    expect(read('js/drawer.js')).toContain("go('checkout')");
    expect(read('js/router.js')).toContain("'#/checkout'");
  });
});

describe('[DoD-10][DoD-11] pricing re-fetch and coupon flow', () => {
  async function build(handler: Parameters<typeof stubApi>[0]) {
    vi.useFakeTimers();
    const calls = stubApi(handler);
    const { createCart } = await load('cart-store.js');
    const { createQuote } = await load('quote.js');
    const cart = createCart();
    const quote = createQuote(cart);
    return {
      calls,
      cart,
      quote,
      calcs: () => calls.filter((c) => c.path === '/pricing/calculate'),
    };
  }

  it('re-fetches the breakdown (debounced) on every quantity change and sends only ids and quantities', async () => {
    const t = await build(() => ({ data: quoteReply() }));
    t.cart.add('SKU-A');
    t.cart.setQty('SKU-A', 3);
    expect(t.calcs()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(400);
    expect(t.calcs()).toHaveLength(1);
    expect(t.calcs()[0]?.body).toMatchObject({
      items: [{ sku: 'SKU-A', quantity: 3 }],
      context: { currency: 'USD' },
    });
    expect(JSON.stringify(t.calcs()[0]?.body)).not.toMatch(/customerTier|unitPrice/);
    t.cart.setQty('SKU-A', 4);
    await vi.advanceTimersByTimeAsync(400);
    expect(t.calcs()).toHaveLength(2);
    t.cart.setRegion('AR');
    t.cart.setDelivery('express');
    await vi.advanceTimersByTimeAsync(400);
    expect(t.calcs()).toHaveLength(3);
    expect(t.calcs()[2]?.body).toMatchObject({ context: { region: 'AR' }, delivery: 'express' });
  });

  it('drops a stale response when a newer request was made', async () => {
    const replies = [quoteReply({ auditId: 'old' }), quoteReply({ auditId: 'new' })];
    let n = 0;
    const t = await build(() => ({ data: replies[n++] }));
    t.cart.add('SKU-A');
    await vi.advanceTimersByTimeAsync(400);
    t.cart.add('SKU-A');
    await vi.advanceTimersByTimeAsync(400);
    expect(t.quote.snapshot().data.auditId).toBe('new');
  });

  it('clears the quote when the cart becomes empty and releases a held coupon', async () => {
    const t = await build((c) =>
      c.path === '/pricing/calculate'
        ? {
            data: quoteReply({
              coupon: { code: 'SAVE10', reservationId: 'r1', discountAmount: 1 },
            }),
          }
        : { data: null },
    );
    t.cart.add('SKU-A');
    await vi.advanceTimersByTimeAsync(400);
    expect(t.quote.snapshot().held.reservationId).toBe('r1');
    t.cart.remove('SKU-A');
    await vi.advanceTimersByTimeAsync(10);
    expect(t.quote.snapshot().data).toBeNull();
    expect(
      t.calls.some((c) => c.method === 'DELETE' && c.path === '/coupons/reservations/r1'),
    ).toBe(true);
  });

  it('shows the server error for an invalid coupon and does not remember the code', async () => {
    const t = await build((c) =>
      c.body && c.body.couponCode
        ? { status: 404, code: 'COUPON_NOT_FOUND' }
        : { data: quoteReply() },
    );
    t.cart.add('SKU-A');
    await vi.advanceTimersByTimeAsync(400);
    await expect(t.quote.apply('NOPE')).rejects.toMatchObject({ code: 'COUPON_NOT_FOUND' });
    expect(t.cart.couponCode()).toBeNull();
    const { describeError } = await load('errors.js');
    expect(describeError({ status: 404, code: 'COUPON_NOT_FOUND', message: 'x' })).toBe(
      'Coupon not found for your account.',
    );
  });

  it('reserves a valid coupon, keeps sending it, and removes it with DELETE then a plain calculate', async () => {
    const coupon = { code: 'SAVE10', reservationId: 'r9', discountAmount: 1000 };
    const t = await build((c) =>
      c.path === '/pricing/calculate'
        ? { data: quoteReply(c.body?.couponCode ? { coupon } : {}) }
        : { data: null },
    );
    t.cart.add('SKU-A');
    await vi.advanceTimersByTimeAsync(400);
    await t.quote.apply('SAVE10');
    expect(t.quote.snapshot().held).toEqual(coupon);
    expect(t.cart.payload().couponCode).toBe('SAVE10');
    t.cart.setQty('SKU-A', 2);
    await vi.advanceTimersByTimeAsync(400);
    expect(t.calcs().at(-1)?.body?.couponCode).toBe('SAVE10');
    await t.quote.removeCoupon();
    const tail = t.calls.slice(-2);
    expect(tail[0]).toMatchObject({ method: 'DELETE', path: '/coupons/reservations/r9' });
    expect(tail[1]?.body?.couponCode).toBeUndefined();
    expect(t.quote.snapshot().held).toBeNull();
  });

  it('keeps the held coupon visible when a re-quote with it fails', async () => {
    let fail = false;
    const coupon = { code: 'SAVE10', reservationId: 'r2', discountAmount: 1 };
    const t = await build(() =>
      fail ? { status: 422, code: 'MIN_SUBTOTAL_NOT_MET' } : { data: quoteReply({ coupon }) },
    );
    t.cart.add('SKU-A');
    await vi.advanceTimersByTimeAsync(400);
    fail = true;
    t.cart.setQty('SKU-A', 2);
    await vi.advanceTimersByTimeAsync(400);
    const snap = t.quote.snapshot();
    expect(snap.data).toBeNull();
    expect(snap.error.code).toBe('MIN_SUBTOTAL_NOT_MET');
    expect(snap.held).toEqual(coupon);
  });

  it('releases a reservation returned by a stale apply response and shows no chip', async () => {
    const coupon = { code: 'SAVE10', reservationId: 'rStale', discountAmount: 5 };
    let release: (v: unknown) => void = () => {};
    const t = await build((c) =>
      c.path === '/pricing/calculate' && c.body?.couponCode
        ? { data: quoteReply({ coupon }) }
        : { data: quoteReply() },
    );
    t.cart.add('SKU-A');
    await vi.advanceTimersByTimeAsync(400);
    const gate = new Promise((r) => (release = r));
    const inner = globalThis.fetch as unknown as (u: string, i: never) => Promise<unknown>;
    vi.stubGlobal('fetch', async (u: string, i: never) => {
      const res = await inner(u, i);
      if (String(i && (i as { body?: string }).body).includes('couponCode')) await gate;
      return res;
    });
    const pending = t.quote.apply('SAVE10');
    t.cart.setQty('SKU-A', 2);
    release(null);
    await pending;
    await vi.advanceTimersByTimeAsync(400);
    expect(t.calls).toContainEqual(
      expect.objectContaining({ method: 'DELETE', path: '/coupons/reservations/rStale' }),
    );
    expect(t.quote.snapshot().held).toBeNull();
    expect(t.cart.payload().couponCode).toBeUndefined();
  });

  it('releaseHeld frees a held reservation on logout but not after a consumed order', async () => {
    const coupon = { code: 'SAVE10', reservationId: 'r7', discountAmount: 5 };
    const t = await build(() => ({ data: quoteReply({ coupon }) }));
    t.cart.add('SKU-A');
    await vi.advanceTimersByTimeAsync(400);
    expect(t.quote.snapshot().held).toEqual(coupon);
    t.quote.releaseHeld();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.calls.filter((c) => c.method === 'DELETE')).toEqual([
      expect.objectContaining({ path: '/coupons/reservations/r7' }),
    ]);
    expect(t.quote.snapshot().held).toBeNull();

    // Order confirmed: same sequence as checkout.js (forget, then cart.reset), then logout.
    t.cart.add('SKU-A');
    await vi.advanceTimersByTimeAsync(400);
    t.quote.forget();
    t.cart.reset();
    t.quote.releaseHeld();
    await vi.advanceTimersByTimeAsync(400);
    expect(t.calls.filter((c) => c.method === 'DELETE')).toHaveLength(1);
  });

  it('wires the release before the token is cleared on logout', () => {
    const auth = read('js/auth.js');
    expect(auth.indexOf('beforeLogout()')).toBeGreaterThan(-1);
    expect(auth.indexOf('beforeLogout()')).toBeLessThan(
      auth.indexOf('setToken(null);\n    onLogout'),
    );
    expect(read('js/main.js')).toContain('quote.releaseHeld()');
  });
});

describe('[DoD-11] checkout', () => {
  it('opens one step at a time, completes and edits steps', async () => {
    const { createSteps } = await load('steps.js');
    const s = createSteps();
    expect(s.states()).toEqual(['active', 'upcoming', 'upcoming']);
    s.advance(0);
    expect(s.states()).toEqual(['done', 'active', 'upcoming']);
    s.advance(1);
    s.open(0);
    expect(s.states()).toEqual(['active', 'done', 'upcoming']);
    s.advance(0);
    expect(s.current()).toBe(1);
    s.reset();
    expect(s.states()).toEqual(['active', 'upcoming', 'upcoming']);
  });

  it('validates the contact step before moving on', async () => {
    const { validateContact } = await load('validate.js');
    const ok = {
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
      street: '1 Main St',
      city: 'Buenos Aires',
      postalCode: 'C1000',
      region: 'AR',
    };
    expect(validateContact(ok)).toEqual({});
    const bad = validateContact({
      email: 'nope',
      fullName: 'A',
      street: '',
      city: '',
      postalCode: '!!',
      region: '',
    });
    expect(Object.keys(bad).sort()).toEqual([
      'city',
      'email',
      'fullName',
      'postalCode',
      'region',
      'street',
    ]);
    expect(validateContact({ ...ok, region: 'ZZ' }).region).toBeDefined();
  });

  it('validates the demo payment fields', async () => {
    const { validatePayment } = await load('validate.js');
    const now = new Date('2026-06-15T00:00:00Z');
    const ok = { number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123', cardName: 'Ada L' };
    expect(validatePayment(ok, now)).toEqual({});
    expect(validatePayment({ ...ok, expiry: '01/20' }, now).expiry).toMatch(/expired/);
    expect(validatePayment({ ...ok, expiry: '13/30' }, now).expiry).toBeDefined();
    expect(
      Object.keys(validatePayment({ number: '1', expiry: '', cvc: '1', cardName: '' }, now)),
    ).toHaveLength(4);
  });

  it('redirects #/checkout with an empty cart to the shop, and never leaks routes logged out', async () => {
    const { resolveView, routeFromHash } = await load('router.js');
    const user = { role: 'customer' };
    expect(routeFromHash('#/checkout')).toBe('checkout');
    expect(routeFromHash('')).toBe('shop');
    expect(resolveView({ user, route: 'checkout', cartEmpty: true, confirmed: false })).toBe(
      'redirect',
    );
    expect(resolveView({ user, route: 'checkout', cartEmpty: false, confirmed: false })).toBe(
      'checkout',
    );
    expect(resolveView({ user, route: 'checkout', cartEmpty: true, confirmed: true })).toBe(
      'checkout',
    );
    expect(resolveView({ user: null, route: 'checkout', cartEmpty: false, confirmed: false })).toBe(
      'auth',
    );
    expect(resolveView({ user, route: 'shop', adminOpen: true })).toBe('shop');
    expect(resolveView({ user: { role: 'admin' }, route: 'shop', adminOpen: true })).toBe('admin');
  });

  it('wires order placement, re-quote on PRICE_CHANGED and the confirmation copy', () => {
    const checkout = read('js/checkout.js');
    for (const text of ['/orders', 'PRICE_CHANGED', 'AUDIT_STALE', 'quote.now()', 'cart.reset()']) {
      expect(checkout).toContain(text);
    }
    const done = read('js/confirmation.js');
    for (const text of [
      'Order confirmed',
      'A receipt is on its way to',
      'Demo only: no email is sent.',
      'Continue shopping',
      'You saved',
    ]) {
      expect(done).toContain(text);
    }
    const html = read('index.html');
    expect(html).toContain('Secure checkout');
    expect(html).toContain('Back to shop');
    for (const text of ['Continue to delivery', 'Continue to payment']) {
      expect(read('js/step-contact.js') + read('js/step-delivery.js')).toContain(text);
    }
  });

  it('shows a coupon chip with Remove, the savings line and the skipped-rules section', () => {
    expect(read('js/coupon-box.js')).toContain('reserved for you');
    const summary = read('js/order-summary.js');
    expect(summary).toContain('You save');
    expect(summary).toContain('skippedSection(');
    expect(read('js/step-delivery.js')).toContain("'Free'");
    expect(read('checkout.css')).toContain('flex: 999 1 560px');
    expect(read('checkout.css')).toContain('flex: 1 1 340px');
  });
});
