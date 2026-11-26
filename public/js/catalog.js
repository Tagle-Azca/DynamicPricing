import { request } from './api.js';

// Store catalog loaded from GET /catalog. Prices are integer cents from the server.
export function createCatalog() {
  let products = [];
  const subs = new Set();
  const emit = () => subs.forEach((fn) => fn());

  return {
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    // Throws on failure; the caller shows the error and a Retry button.
    async load() {
      try {
        products = await request('GET', '/catalog');
      } catch (err) {
        products = [];
        emit();
        throw err;
      }
      emit();
    },
    all: () => products,
    find: (sku) => products.find((p) => p.sku === sku),
    categories: () => [...new Set(products.map((p) => p.category))].sort(),
    reset() {
      products = [];
      emit();
    },
  };
}
