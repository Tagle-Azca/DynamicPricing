import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC = join(__dirname, '..', 'public');
const read = (file: string): string => readFileSync(join(PUBLIC, file), 'utf8');

// Pure helpers only; the modules touch the DOM at call time, not at import time.
const load = async (file: string) => import(join(PUBLIC, 'js', file));

describe('admin products: edit form and filters', () => {
  it('has the edit form, the filters and a sticky tab bar in the page', () => {
    const html = read('index.html');
    for (const id of [
      'product-edit',
      'product-edit-form',
      'pe-name',
      'pe-category',
      'pe-price',
      'pe-currency',
      'pe-image',
      'pf-search',
      'pf-category',
      'pf-active',
      'products-count',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(read('styles.css')).toMatch(/\.subtabs \{[^}]*position: sticky/);
  });

  it('sends only the fields that changed', async () => {
    const { diff } = await load('admin-product-edit.js');
    const product = {
      sku: 'SKU-A',
      name: 'A',
      category: 'audio',
      unitPrice: 1000,
      currency: 'USD',
      imageUrl: undefined,
      isActive: true,
    };
    const same = {
      name: 'A',
      category: 'audio',
      unitPrice: 1000,
      currency: 'USD',
      imageUrl: null,
      isActive: true,
    };
    expect(diff(product, same)).toEqual({});
    expect(diff(product, { ...same, unitPrice: 1200, imageUrl: 'https://x' })).toEqual({
      unitPrice: 1200,
      imageUrl: 'https://x',
    });
    expect(diff({ ...product, imageUrl: 'https://x' }, same)).toEqual({ imageUrl: null });
  });

  it('filters by text, category and status', async () => {
    const { matches } = await load('admin-product-table.js');
    const p = { sku: 'SKU-MOUSE', name: 'Optical mouse', category: 'accessories', isActive: true };
    const none = { text: '', category: '', active: '' };
    expect(matches(p, none)).toBe(true);
    expect(matches(p, { ...none, text: 'MOUSE' })).toBe(true);
    expect(matches(p, { ...none, text: 'laptop' })).toBe(false);
    expect(matches(p, { ...none, category: 'audio' })).toBe(false);
    expect(matches(p, { ...none, active: 'no' })).toBe(false);
    expect(matches({ ...p, isActive: false }, { ...none, active: 'no' })).toBe(true);
  });

  it('never builds markup from data in the edit and table modules', () => {
    for (const f of ['admin-product-edit.js', 'admin-product-table.js', 'admin-products.js']) {
      expect(read(`js/${f}`)).not.toMatch(/innerHTML|insertAdjacentHTML|document\.write/);
    }
  });
});
