// Hash routes: "#/" is the shop, "#/checkout" the checkout. Other hashes (skip link) are ignored.
export const routeFromHash = (hash) => (hash === '#/checkout' ? 'checkout' : 'shop');

export const currentRoute = () => routeFromHash(document.location.hash);

export function go(route) {
  document.location.hash = route === 'checkout' ? '#/checkout' : '#/';
}

export function onRouteChange(fn) {
  document.defaultView.addEventListener('hashchange', () => {
    if (document.location.hash === '' || document.location.hash.startsWith('#/'))
      fn(currentRoute());
  });
}

// Which view to show. Not logged in always gives 'auth' (no route leak); #/checkout with an
// empty cart redirects to the shop, except on the confirmation screen after an order.
export function resolveView({ user, route, cartEmpty, confirmed, adminOpen }) {
  if (!user) return 'auth';
  if (route === 'checkout') return cartEmpty && !confirmed ? 'redirect' : 'checkout';
  return adminOpen && user.role === 'admin' ? 'admin' : 'shop';
}
