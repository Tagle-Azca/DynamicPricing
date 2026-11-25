import { h } from './dom.js';

// Product image, or a neutral CSS placeholder when imageUrl is missing.
export function thumb(product, className = 'thumb') {
  const box = h('span', { class: className });
  if (product && product.imageUrl) {
    box.append(
      h('img', {
        src: product.imageUrl,
        alt: product.name,
        loading: 'lazy',
        decoding: 'async',
        referrerpolicy: 'no-referrer',
      }),
    );
  } else {
    box.classList.add('thumb-empty');
  }
  return box;
}
