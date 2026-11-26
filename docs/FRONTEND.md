# Frontend (tienda, carrito y checkout)

Interfaz estática en `public/`, sin build ni dependencias. Módulos ES servidos por Express con CSP estricta (`script-src 'self'`). El código y los textos de la interfaz están en inglés; esta guía en español.

## Estructura

- `index.html`: encabezados (tienda y checkout), vistas `auth`, `shop`, `admin`, `checkout`, cajón del carrito.
- `theme.css` (tokens claros y fuentes), `styles.css` (base y Admin, con tokens propios bajo `body.admin-mode`), `shop.css` (header, banner, tarjetas, cajón), `checkout.css`.
- `fonts/`: Inter y Space Grotesk autoalojadas (sin CDN).
- `js/`: estado y red (`api.js`, `cart-store.js`, `quote.js`, `catalog.js`, `campaigns.js`), tienda (`product-*.js`, `banner.js`, `drawer*.js`), checkout (`checkout.js`, `step-*.js`, `order-summary.js`, `coupon-box.js`, `confirmation.js`, `steps.js`, `validate.js`), ruteo (`router.js`, `shell.js`, `main.js`) y Admin (`admin-*.js`, `admin-boot.js`).

## Rutas

Por hash: `#/` tienda, `#/checkout` pago. Admin es una pestaña del encabezado. Sin sesión siempre se muestra el login (`resolveView`). `#/checkout` con carrito vacío redirige a `#/` (salvo en la pantalla de confirmación).

## Reglas

- El servidor es la fuente de verdad de todo monto: la interfaz no suma, resta ni multiplica dinero. Solo `js/money.js` divide entre 100, y únicamente para dar formato (`$1,210.00`).
- Barras de progreso con `progressPercent`, "Add $X more" con `nextThreshold.remaining`, líneas con `lineTotal`, ahorro con `savings`, total con `grandTotal` o `finalTotal`.
- Cada cambio de carrito, región, entrega o cupón vuelve a llamar a `POST /pricing/calculate` (con debounce; las respuestas viejas se descartan).
- Cupón: aplicar es calcular con `couponCode`; quitar es `DELETE /coupons/reservations/:id` y calcular sin código.
- El pago es una demostración: los datos de tarjeta no se envían ni se guardan. `POST /orders` lleva solo `auditId`, contacto y dirección.
- CSP: sin scripts ni estilos en línea, solo `textContent` (nada de `innerHTML`), JWT en memoria, sin `window.confirm` ni `alert`.
- El nivel del cliente viene de la cuenta en el servidor; la región se elige en el checkout.
- Accesibilidad: controles reales, `aria-label` en botones de solo icono, foco visible, objetivos de 44 px, `prefers-reduced-motion`.

## Cómo ejecutar

```
npm run dev              # servidor con la API y la interfaz en http://localhost:3000
npx vitest run tests/ui.test.ts   # pruebas de la interfaz
npm run format:check && npm run lint && npm run typecheck
```
