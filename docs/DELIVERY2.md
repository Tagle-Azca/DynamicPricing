# Entregable 2: contenido del reporte (para pegar en el PDF incremental)

> La evidencia completa de ejecución (46 escenarios HTTP reales, con cada request y response) está en
> `docs/evidence/EVIDENCE.md`, y en Word en `docs/evidence/Delivery2-Evidence.docx`.

Enfoque: 100% Backend (Opción A) más una interfaz web sencilla. Evidencia: 46 escenarios HTTP reales
(`npm run evidence`) y 123 pruebas automatizadas (`npm test`). Contrato de la API: `docs/openapi.yaml`. Diagramas de flujo: `docs/ARCHITECTURE.md`.

## 1. Estado actual: qué cambió desde el Entregable 1

Entregable 1: motor de precios, reserva transaccional de cupones y snapshots de auditoría inmutables
(todo anónimo, cupones globales, sin administración).

El Entregable 2 agrega: autenticación y roles, cupones de un solo uso ligados a un usuario, campañas
por región, administración de campañas y cupones, verificación y exportación de auditorías, un mapa
de regiones con descuentos, endurecimiento de la API, pruebas y CI. Todos los endpoints del
Entregable 1 siguen funcionando; ahora requieren un token.

## 2. Estimación de avance: aproximadamente 75%

| Área                                                                | Estado     |
| ------------------------------------------------------------------- | ---------- |
| Motor de reglas de precios, snapshots de auditoría, inmutabilidad   | hecho (E1) |
| Cupones transaccionales, sin sobreventa                             | hecho (E1) |
| Autenticación, roles, propiedad, límites de tasa, CORS, helmet, CI  | hecho (E2) |
| Cupones ligados a un usuario y consumidos al usarse                 | hecho (E2) |
| CRUD de campañas y cupones para el admin (precios por fecha)        | hecho (E2) |
| Condiciones por región y temporada                                  | hecho (E2) |
| Respaldo de auditoría (verificar y exportar JSON/CSV)               | hecho (E2) |
| Interfaz básica (tienda, administración, mapa de regiones)          | hecho (E2) |
| Catálogo de productos (precios desde el servidor)                   | hecho (E2) |
| Cupón y precios en una sola solicitud (total final)                 | hecho (E2) |
| Ciclo de vida de reservas (liberar, expirar) y límite por usuario   | hecho (E2) |
| Impuestos por región y exportación por periodo fiscal               | pendiente  |
| Eventos de cupones en la auditoría, endpoint de verificación masiva | pendiente  |
| Tienda basada en catálogo, documentación OpenAPI                    | hecho (E2) |

Justificación: el motor central, las partes transaccionales, la seguridad y el panel de administración
existen y funcionan de punta a punta, con una interfaz básica encima, un catálogo de productos en el
servidor y el cupón integrado al cálculo de precios. Faltan los impuestos por región y los eventos de
cupones en la auditoría.

## 3. Nuevas features

### Feature A: autenticación, roles y propiedad

- Problema: cualquier persona anónima podía calcular precios, gastar cupones y leer auditorías.
- Reglas: roles `customer` y `admin`; el registro siempre crea un cliente; contraseñas de 12 a 72
  bytes con bcrypt; JWT HS256 con issuer, audience y expiración de 15 minutos; el dueño de la auditoría
  es el sujeto del token (un cliente que envía otro `userId` recibe 403 `USER_MISMATCH`); la auditoría
  de otro usuario devuelve 404.
- Endpoints: `POST /auth/register` (201, 400, 409 `EMAIL_TAKEN`, 429), `POST /auth/login` (200, 401
  `INVALID_CREDENTIALS`, 429), `GET /auth/me`.
- Flujo: ver los diagramas "register/login" y "protected request". Evidencia: escenarios 30 y 31.

### Feature B: cupones de un solo uso ligados a un usuario

- Problema: los cupones eran globales (el brief original pide que sean de un usuario y se consuman al
  usarse).
- Reglas: `userId` opcional en el cupón; otros usuarios reciben 404 `COUPON_NOT_FOUND` (igual que un
  código inexistente); `maxUses` 1 significa que se consume al aplicarse (`remainingUses` 0, los
  intentos posteriores reciben 409 `COUPON_EXHAUSTED`); la reserva guarda al usuario; el decremento
  sigue siendo atómico dentro de la transacción de Mongo.
- Endpoint: `POST /coupons/apply`. Flujo: diagrama de aplicar cupón. Evidencia: escenarios 36 a 39.

### Feature C: catálogo de administración y precios por región

- Problema: las campañas y los cupones solo venían del script de seed; no había precios por temporada
  ni por zona geográfica.
- Reglas: solo admin; los códigos se pasan a mayúsculas y son únicos; `endsAt` posterior a `startsAt`;
  porcentaje de máximo 100; los campos desconocidos se rechazan; `conditions.regions` junto con
  `context.region` (las campañas que no coinciden se omiten con `REGION_NOT_ELIGIBLE`); el precio por
  temporada es un rango de fechas que define el admin (por ejemplo Año Nuevo Lunar para CN, verano del
  sur para AU/AR/CL, ambos en el seed).
- Endpoints: `GET/POST /admin/campaigns`, `PATCH /admin/campaigns/:code`, `GET/POST /admin/coupons`,
  `PATCH /admin/coupons/:code`. Evidencia: escenarios 32 a 35.
- Mapa de regiones: `GET /admin/regions` agrupa las campañas por región; `PUT` / `DELETE
/admin/campaigns/:code/regions/:region` agregan o quitan una región de forma atómica e idempotente;
  quitar la última región devuelve 409 `LAST_REGION`. Evidencia: escenarios 42 a 45.

### Feature D: respaldo de auditoría

- Problema: el admin necesita un registro confiable de cada transacción.
- Reglas: `checksumValid` se recalcula en cada lectura, así que las ediciones accidentales o simples
  hechas fuera de la API aparecen como `false` (probado alterando directamente MongoDB; el checksum es
  un SHA-256 sin llave, ver la sección 5); exportación por periodo en JSON o CSV, máximo 10000 filas
  (las celdas CSV que empiezan con `= + - @ TAB CR` se neutralizan contra inyección de fórmulas, y se
  envían como archivo adjunto).
- Endpoints: `GET /admin/audits`, `GET /admin/audits/:auditId`, `GET /admin/audits/export`.
  Evidencia: escenarios 40 y 41.

### Feature E: interfaz web básica

- Problema: la API solo se podía probar con curl.
- Reglas: JavaScript vanilla en `public/`, servido por Express desde el mismo origen (la CSP de Helmet
  se mantiene intacta); el JWT se guarda solo en memoria, así que al recargar se cierra la sesión; el
  catálogo de la tienda se carga desde `GET /catalog` y el carrito solo envía `sku` y `quantity`.
- Vistas: (1) tienda con catálogo del servidor, carrito, desglose de precio en vivo y cupón con total final; (2) panel de
  administración con mapa de regiones (pasar el cursor muestra los descuentos, hacer clic agrega o
  quita un país de una campaña), productos, campañas, cupones y auditorías (listar, verificar checksum, exportar
  JSON/CSV).

### Feature F: catálogo de productos y precios resueltos por el servidor

- Problema: el cliente enviaba `unitPrice`, `name` y `category`, así que podía fijar su propio precio.
- Reglas: colección `Product` (`sku` único en mayúsculas, `name`, `category`, `unitPrice` entero en
  centavos, `currency`, `isActive`); cada ítem del carrito es solo `{ sku, quantity }` (cualquier otro
  campo da 400); un SKU desconocido o inactivo da 422 `UNKNOWN_SKU` con `details.skus`; una moneda
  distinta a `context.currency` da 422 `CURRENCY_MISMATCH`; la auditoría guarda los ítems resueltos
  (`sku, name, category, unitPrice, quantity`), de modo que cambiar un precio no altera auditorías
  anteriores y las auditorías antiguas siguen verificando (el cupón entra al checksum solo si existe).
- Endpoints: `GET /catalog` (cualquier usuario autenticado, solo activos), `GET/POST /admin/products`
  (409 `PRODUCT_EXISTS`), `PATCH /admin/products/:sku` (404 `PRODUCT_NOT_FOUND`). `npm run seed` crea
  seis productos. Evidencia: escenarios 1 a 5 y 25 a 29.

### Feature G: cupón dentro del cálculo, ciclo de vida de la reserva y límite por usuario

- Problema: el subtotal del cupón lo enviaba el cliente, las reservas nunca se liberaban y un usuario
  podía agotar un cupón global.
- Reglas: `POST /pricing/calculate` acepta `couponCode` y devuelve `finalTotal` y `coupon`; la reserva
  del cupón y la escritura de la auditoría son una sola transacción (si una falla, `remainingUses` no
  cambia). `POST /coupons/apply` ahora recibe `{ code, auditId }`: el subtotal es `result.total` de la
  auditoría propia y un `subtotal` del cliente da 400. Cada reserva tiene `status` (`RESERVED` /
  `RELEASED`) y `expiresAt` (`RESERVATION_TTL_SECONDS`, 900 por defecto);
  `DELETE /coupons/reservations/:id` restaura exactamente un uso (una segunda vez, 409); la función
  `releaseExpiredReservations` corre en un intervalo con `unref()` desde `server.ts`. `perUserLimit`
  (1 por defecto) limita las reservas activas por usuario con 409 `COUPON_LIMIT_REACHED`, de forma
  segura bajo concurrencia: se descuenta primero el cupón y luego se cuentan las reservas del usuario
  dentro de la transacción. El índice único `{couponCode, cartId}` es parcial (solo `RESERVED`).
- Evidencia: escenarios 9 a 23 (incluye 25 solicitudes en paralelo sobre `maxUses` 5 y la barrida).

### Feature H: documentación OpenAPI

- `docs/openapi.yaml` (OpenAPI 3.0.3) describe todas las rutas de `/api/v1`, el esquema Bearer y los
  códigos de error; una prueba automática falla si una ruta registrada no aparece en el documento.

### Feature I: envío, pedido de demostración y campañas activas

El cálculo devuelve opciones de envío, `lineTotal`, `savings` y la siguiente meta de campaña; `POST /orders` convierte una auditoría en un pedido recalculado por el servidor, consume el cupón y es idempotente. El nivel del cliente se guarda en el usuario y las imágenes de producto se restringen a Cloudinary. Detalles en `README.md` y `docs/openapi.yaml`.

## 4. Resumen de endpoints (agregados o modificados)

| Método         | Ruta                           | Acceso          | Notas                                                       |
| -------------- | ------------------------------ | --------------- | ----------------------------------------------------------- |
| POST           | /auth/register, /auth/login    | público         | con límite de tasa                                          |
| GET            | /auth/me                       | cualquier rol   |                                                             |
| GET            | /catalog                       | customer, admin | nuevo                                                       |
| POST           | /pricing/calculate             | customer, admin | cambió: solo `sku` y `quantity`, `couponCode`, `finalTotal` |
| GET            | /pricing/audit/:id             | dueño, admin    | cambió: propiedad                                           |
| POST           | /coupons/apply                 | customer, admin | cambió: recibe `auditId`, devuelve 201                      |
| DELETE         | /coupons/reservations/:id      | dueño           | nuevo                                                       |
| GET/POST/PATCH | /admin/products                | admin           | nuevo                                                       |
| GET/POST/PATCH | /admin/campaigns               | admin           | nuevo                                                       |
| GET/POST/PATCH | /admin/coupons                 | admin           | nuevo                                                       |
| GET            | /admin/regions                 | admin           | nuevo                                                       |
| PUT/DELETE     | /admin/campaigns/:c/regions/:r | admin           | nuevo                                                       |
| GET            | /admin/audits, /:id, /export   | admin           | nuevo (el listado ya existía)                               |
| GET            | /campaigns/active              | customer, admin | nuevo                                                       |
| POST           | /orders                        | customer, admin | nuevo: pedido de demostración, idempotente                  |

Códigos de error agregados: 401 `AUTH_REQUIRED` `TOKEN_EXPIRED` `TOKEN_INVALID` `INVALID_CREDENTIALS`;
403 `FORBIDDEN` `USER_MISMATCH`; 404 `CAMPAIGN_NOT_FOUND`; 409 `EMAIL_TAKEN` `DUPLICATE_RESOURCE`
`LAST_REGION`; 422 `AMOUNT_TOO_LARGE` `EXPORT_TOO_LARGE` `UNKNOWN_SKU` `CURRENCY_MISMATCH`; 429 `RATE_LIMITED`;
404 `PRODUCT_NOT_FOUND` `RESERVATION_NOT_FOUND`; 409 `PRODUCT_EXISTS` `COUPON_LIMIT_REACHED`
`RESERVATION_NOT_ACTIVE`; nuevos de esta etapa: 422 `SHIPPING_UNSUPPORTED_CURRENCY`
`IMAGE_URL_NOT_ALLOWED` `DELIVERY_REQUIRED` `REGION_MISMATCH`; 409 `PRICE_CHANGED`
`COUPON_RESERVATION_INVALID`.

## 5. Problemas encontrados y decisiones técnicas

- `sanitizeFilter` de Mongoose bloquea operadores como `$gte` que vienen de la entrada: los rangos
  internos de confianza usan `mongoose.trusted`; la entrada del usuario nunca lo usa.
- El rol del JWT se lee del token sin consultar la base de datos, así que un cambio de rol se aplica
  cuando el token expira (compromiso aceptado, tokens de 15 minutos, documentado).
- La auditoría de otro usuario devuelve 404 y no 403 para que no se puedan adivinar los ids.
- Un correo duplicado en el registro devuelve 409 (compromiso aceptado de enumeración de cuentas, por
  usabilidad).
- El limitador de tasa usa memoria, así que los límites son por instancia.
- La inmutabilidad de la auditoría se aplica en Mongoose; una escritura directa a la base de datos la
  salta, por eso el checksum se verifica al leer.
- Zod 4 cambió la forma de los errores de validación; la evidencia se regeneró.
- Revisión de seguridad (13 hallazgos, ninguno Crítico ni Alto). Corregido: mongoose fijado en 8.24.9
  (advisories eliminados, `npm audit --omit=dev` reporta 0); los códigos con solo espacios ahora dan
  400 y no 500; las fechas solo aceptan cadenas ISO; cantidad y precio unitario con tope, subtotales
  inseguros rechazados con 422; el CSV neutraliza TAB/CR y quita caracteres de control; un cupón ligado
  a otro usuario es un 404, igual que uno inexistente; la exportación de auditoría tiene tope de 10000
  filas y se rechaza `from > to`; las regiones se recortan y el PATCH de `conditions` se mezcla campo
  por campo; CORS permite PATCH, PUT y DELETE.
- Limitaciones conocidas, no corregidas en este entregable:
  - Checksum sin llave (S3): el checksum de la auditoría es SHA-256 simple, así que detecta ediciones
    accidentales o simples, pero no a alguien con acceso a la base de datos que lo recalcule. Planeado:
    HMAC-SHA256 con un secreto dedicado.
- Resueltas en esta iteración: `POST /orders` consume la reserva (`RESERVED` -> `CONSUMED`) y recalcula en el servidor (frontera de confianza en `README.md`); el subtotal del cupón ya no lo envía el cliente (S1, ahora `auditId`) y
  existe un límite por usuario (S2, `perUserLimit`; la evidencia de concurrencia usa `FLASH5` con
  `perUserLimit` 5).

## 6. Conclusión parcial: qué falta

Impuestos por región y exportación por periodo fiscal, eventos de cupones en la auditoría y un
endpoint de verificación masiva, revocación de tokens y límite de intentos de inicio de sesión por
cuenta, y un cobro real (`PAID`) con proveedor de pagos: hoy el pedido es de demostración (`DEMO_NOT_CHARGED`).
