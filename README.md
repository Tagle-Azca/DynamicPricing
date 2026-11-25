# Motor de Precios Dinámicos y Promociones - Entregable 2

API REST (Node, TypeScript, Express, Mongoose, Zod) que ofrece:

1. **Cálculo de precios por reglas** a partir de campañas en MongoDB (`POST /api/v1/pricing/calculate`).
2. **Reserva transaccional de cupones** sin sobreventa (`POST /api/v1/coupons/apply`, o `couponCode` en el cálculo), con ciclo de vida (liberar y expirar) y límite por usuario.
3. **Snapshots de auditoría de precios inmutables** (`GET /api/v1/pricing/audit/:auditId`).
4. **Catálogo de productos en el servidor** (`GET /api/v1/catalog`, administración en `/api/v1/admin/products`): los precios nunca vienen del cliente.

El Entregable 2 agrega autenticación JWT con roles, verificación de propiedad, cupones de un solo uso
ligados a un usuario, campañas por región, CRUD de campañas y cupones para el admin, un respaldo de
auditoría (verificar y exportar), una interfaz web con mapa de regiones, endurecimiento de la API y un
pipeline de CI. Evidencia: [docs/evidence/EVIDENCE.md](docs/evidence/EVIDENCE.md). Diagramas de flujo:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Contrato de la API (OpenAPI 3): [docs/openapi.yaml](docs/openapi.yaml). Todos los montos son enteros en centavos.

## Instalación

```bash
npm install
cp .env.example .env
```

`.env` está en `.gitignore`. `.env.example` solo contiene valores de ejemplo y `JWT_SECRET` está vacío
a propósito: el servidor no arranca sin él. Genera uno con `openssl rand -hex 32`.

| Variable                                                           | Valor por defecto                             | Notas                                                                                            |
| ------------------------------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `MONGODB_URI`                                                      | requerida                                     | URI de replica set (transacciones)                                                               |
| `JWT_SECRET`                                                       | requerida                                     | Mínimo 32 caracteres, nunca se sube al repositorio                                               |
| `JWT_TTL_SECONDS`                                                  | 900                                           | De 60 a 86400                                                                                    |
| `JWT_ISSUER` / `JWT_AUDIENCE`                                      | dynamic-pricing-api / dynamic-pricing-clients | Se verifican en cada solicitud                                                                   |
| `CORS_ORIGINS`                                                     | vacío                                         | Orígenes http(s) separados por coma; `*` se rechaza                                              |
| `RATE_LIMIT_WINDOW_MS`                                             | 60000                                         | Ventana de todos los limitadores                                                                 |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_COUPON_MAX` | 100 / 10 / 10                                 | Global por IP, registro+login por IP, aplicar cupón por usuario                                  |
| `RESERVATION_TTL_SECONDS`                                          | 900                                           | Vigencia de una reserva de cupón (1 a 86400); la barrida la libera al vencer                     |
| `AUDIT_QUOTE_TTL_SECONDS`                                          | 900                                           | Antigüedad máxima de una auditoría para aplicarle un cupón (1 a 86400); si no, 409 `AUDIT_STALE` |
| `BCRYPT_ROUNDS`                                                    | 12                                            | De 10 a 14                                                                                       |
| `TRUST_PROXY`                                                      | false                                         | Usar true solo detrás de un proxy de confianza                                                   |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`                         | sin definir                                   | `npm run seed` crea este admin si ambas están definidas                                          |

## MongoDB (se requiere replica set para las transacciones)

Local, con Docker (replica set `rs0` de un nodo, iniciado automáticamente por el healthcheck):

```bash
docker compose up -d
```

MongoDB Atlas: crea un cluster (replica set por defecto) y define `MONGODB_URI` con la cadena de
conexión `mongodb+srv://...`, incluyendo un nombre de base de datos como `/dynamic_pricing`.

## Ejecución

```bash
npm run seed   # idempotente: reinicia productos, campañas, cupones y reservas (nunca las auditorías)
npm run dev    # tsx watch src/server.ts
npm run build && npm start
```

Otros scripts: `npm run typecheck` (src y pruebas), `npm run lint`, `npm run format`,
`npm run format:check`, `npm test`.

## Interfaz web

Una interfaz pequeña en JavaScript vanilla vive en `public/` y Express la sirve desde el mismo origen
(no se necesita CORS y la CSP de Helmet no cambia). No hay nada que compilar ni instalar para el front.

Cómo ejecutarla:

1. Instalar y configurar (solo la primera vez):

   ```bash
   npm install
   cp .env.example .env
   ```

   En `.env` define `JWT_SECRET` (genera uno con `openssl rand -hex 32`). Para tener una cuenta de
   admin, define también `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` (mínimo 12 caracteres).

2. Iniciar MongoDB, cargar los datos de ejemplo y arrancar el servidor:

   ```bash
   docker compose up -d   # replica set de MongoDB en el puerto 27018 del equipo
   npm run seed           # campañas y cupones de ejemplo, crea el admin si está configurado
   npm run dev
   ```

3. Abrir http://localhost:3000/ (el `PORT` de `.env`; usa otro puerto si el 3000 está ocupado).

Qué se puede hacer:

- **Tienda** (cualquier usuario, primero se registra): el catálogo viene de `GET /catalog`; el carrito
  envía solo `sku` y `quantity` (más `couponCode`), y el subtotal, los descuentos, el cupón y el total
  final los muestra tal como los calcula el servidor.
- **Admin** (iniciar sesión con el admin del seed): un mapa mundial donde al pasar el cursor sobre un
  país se ven sus descuentos y al hacer clic se agrega o quita ese país de una campaña, además de
  productos (crear y editar precios), campañas, cupones y auditorías (verificar el checksum, exportar JSON o CSV).

El JWT se guarda solo en memoria, así que al recargar la página se cierra la sesión.

## Limitaciones conocidas

- Las reservas de cupón no las consume ninguna compra: solo se reservan, se liberan (`DELETE`) o
  expiran. La barrida de expiración corre dentro del proceso del servidor (cada 30 s); si hay varias
  instancias, ejecutarla en todas es seguro porque la liberación es idempotente.
- El checksum de la auditoría es un SHA-256 sin llave: detecta ediciones accidentales o simples, pero no
  a alguien con acceso de escritura a MongoDB que lo recalcule. Planeado: HMAC-SHA256 con un secreto
  dedicado.
- Fuera de alcance de esta entrega: impuestos, eventos de cupones y verificación masiva, revocación de
  tokens y límite de intentos de inicio de sesión por cuenta.

## Evidencia

```bash
npm run evidence
```

Genera un `JWT_SECRET` aleatorio si no hay uno, crea un cliente, inicia sesión por HTTP y envía el
token en cada solicitud. Levanta un replica set de MongoDB en memoria (`mongodb-memory-server`, el
binario se descarga la primera vez), carga los datos de ejemplo, ejecuta la app, hace solicitudes HTTP
reales para 46 escenarios (catálogo y productos, cupones por `auditId`, liberación y expiración de
reservas, una prueba de concurrencia de 25 solicitudes, la inmutabilidad de
la auditoría y una prueba de arranque de `server.ts` con SIGINT) y escribe
`docs/evidence/EVIDENCE.md`. El código de salida es distinto de cero si algún escenario falla.

## Autenticación y roles

Los roles son `customer` y `admin`. `POST /api/v1/auth/register` siempre crea un `customer`; un campo
`role` en el cuerpo se rechaza con 400. Los admins se crean solo con `npm run seed` y las variables
`SEED_ADMIN_*`.

```bash
curl -X POST localhost:3000/api/v1/auth/register -H 'content-type: application/json' \
  -d '{ "email": "ana@example.com", "password": "a-long-passphrase-123" }'
curl -X POST localhost:3000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{ "email": "ana@example.com", "password": "a-long-passphrase-123" }'
# -> { "data": { "accessToken": "...", "tokenType": "Bearer", "expiresIn": 900, "user": {...} } }
curl localhost:3000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

Contraseñas: mínimo 12 caracteres, máximo 72 bytes, guardadas como hashes bcrypt. Los tokens son JWT
HS256 (`sub`, `role`, `iss`, `aud`, `iat`, `exp`) con vigencia por defecto de 15 minutos. No hay
tokens de refresco ni revocación: un cambio de rol se aplica cuando el token expira. Códigos 401:
`AUTH_REQUIRED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `INVALID_CREDENTIALS`. 403: `FORBIDDEN`,
`USER_MISMATCH`. 429: `RATE_LIMITED`. Registrar un correo existente devuelve 409 `EMAIL_TAKEN`
(compromiso aceptado de enumeración de cuentas).

| Endpoint                                                        | Acceso                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| `GET /health`                                                   | público                                                  |
| `POST /api/v1/auth/register`                                    | público, con límite de tasa                              |
| `POST /api/v1/auth/login`                                       | público, con límite de tasa                              |
| `GET /api/v1/auth/me`                                           | customer, admin                                          |
| `GET /api/v1/catalog`                                           | customer, admin (solo productos activos)                 |
| `POST /api/v1/pricing/calculate`                                | customer (solo su propio userId), admin                  |
| `GET /api/v1/pricing/audit/:id`                                 | customer (solo sus auditorías), admin (cualquiera)       |
| `POST /api/v1/coupons/apply`                                    | customer, admin, límite de tasa más estricto por usuario |
| `DELETE /api/v1/coupons/reservations/:id`                       | dueño de la reserva, mismo límite de tasa                |
| `GET/POST /api/v1/admin/products`, `PATCH .../products/:sku`    | solo admin                                               |
| `GET /api/v1/admin/audits`                                      | solo admin (`limit` 1..100, `userId`, `cartId`)          |
| `GET /api/v1/admin/audits/:id`                                  | solo admin, devuelve `checksumValid` (recalculado)       |
| `GET /api/v1/admin/audits/export`                               | solo admin, `format=json\|csv`, `from`, `to`             |
| `GET/POST /api/v1/admin/campaigns`, `PATCH .../campaigns/:code` | solo admin                                               |
| `GET/POST /api/v1/admin/coupons`, `PATCH .../coupons/:code`     | solo admin                                               |
| `GET /api/v1/admin/regions`                                     | solo admin, campañas agrupadas por región                |
| `PUT/DELETE /api/v1/admin/campaigns/:code/regions/:region`      | solo admin, idempotente; la última región -> 409         |

`GET /pricing/audit/:id` devuelve 404 `AUDIT_NOT_FOUND` para una auditoría de otra persona, igual que
para un id inexistente. El limitador de tasa usa memoria, así que los límites son por instancia.

## CI/CD

`.github/workflows/ci.yml` corre en cada push y pull request: typecheck, lint, format:check, build,
`npm test` (Vitest y Supertest sobre un replica set en memoria), `npm run evidence` (el reporte se
sube como artefacto), un job separado de `npm audit --audit-level=high` y, solo en pushes a `main`, un
`docker build` (solo construye, no publica nada). `.github/workflows/codeql.yml` corre CodeQL en pull
requests, en `main` y cada semana. `.github/dependabot.yml` actualiza npm y GitHub Actions cada semana.
El CI genera un `JWT_SECRET` aleatorio al ejecutarse; no se guarda ningún secreto en el repositorio.

```bash
docker build -t dynamic-pricing .
docker run --rm -p 3000:3000 --env-file .env dynamic-pricing
```

## Endpoints

Éxito: `{ "data": ... }`. Error: `{ "error": { "code", "message", "details?" } }`.

### GET /api/v1/catalog

Cualquier usuario autenticado. Devuelve `{ "data": [{ sku, name, category, unitPrice, currency }] }` solo
con productos activos, ordenados por `sku`.

### POST /api/v1/pricing/calculate

```bash
curl -X POST localhost:3000/api/v1/pricing/calculate -H 'content-type: application/json' \
  -H "Authorization: Bearer $TOKEN" -d '{
  "cartId": "cart-1",
  "items": [{ "sku": "SKU-KEYBOARD", "quantity": 2 }],
  "context": { "customerTier": "gold", "currency": "USD" },
  "couponCode": "WELCOME10"
}'
```

Cada ítem es solo `{ sku, quantity }`: enviar `unitPrice`, `name` o `category` devuelve 400, y un SKU
desconocido o inactivo devuelve 422 `UNKNOWN_SKU` (`details.skus`). El servidor toma nombre, categoría y
precio de la colección de productos; si la moneda del producto no coincide con `context.currency`, 422
`CURRENCY_MISMATCH`. El snapshot de auditoría guarda los ítems ya resueltos, así que cambiar un precio
después no altera las auditorías anteriores.

`context.userId` es opcional: el servidor lo toma del token (un cliente que envía otro valor recibe 403
`USER_MISMATCH`). Devuelve `auditId, cartId, items[], currency, subtotal, appliedRules[], skippedRules[],
totalDiscount, total, calculatedAt` y `finalTotal` (`total` menos el descuento del cupón). Si se envió
`couponCode`, también `coupon { code, discountAmount, reservationId, remainingUses, expiresAt }`: la
reserva del cupón y la escritura de la auditoría ocurren en una sola transacción, de modo que si una
falla `remainingUses` no cambia. Errores del cupón: los mismos que en `/coupons/apply`.

### GET /api/v1/pricing/audit/:auditId

```bash
curl localhost:3000/api/v1/pricing/audit/<uuid> -H "Authorization: Bearer $TOKEN"
```

400 si el uuid está mal formado, 404 `AUDIT_NOT_FOUND`, 200 con el snapshot y su `checksum` sha256.

### POST /api/v1/coupons/apply

```bash
curl -X POST localhost:3000/api/v1/coupons/apply -H 'content-type: application/json' \
  -H "Authorization: Bearer $TOKEN" -d '{ "code": "WELCOME10", "auditId": "<uuid de una auditoría propia>" }'
```

El subtotal es `result.total` de la auditoría y el carrito es su `cartId`; el cliente no puede enviar
`subtotal` (400). Una auditoría ajena o inexistente devuelve 404 `AUDIT_NOT_FOUND`. Responde 201 con
`status: "RESERVED"`, `reservationId`, `discountAmount`, `newTotal`, `remainingUses` y `expiresAt`.

Un cupón puede estar ligado a un usuario (`userId`): cualquier otra persona recibe 404
`COUPON_NOT_FOUND`, igual que con un código desconocido, para que no se puedan adivinar los códigos. Un
cupón de un solo uso (`maxUses` 1) se consume al aplicarse y los intentos posteriores reciben 409
`COUPON_EXHAUSTED`. Errores: 404 `COUPON_NOT_FOUND` / `AUDIT_NOT_FOUND`, 409 `COUPON_UNAVAILABLE` /
`COUPON_ALREADY_APPLIED` / `COUPON_EXHAUSTED` / `COUPON_LIMIT_REACHED`, 422 `MIN_SUBTOTAL_NOT_MET`,
400 `VALIDATION_ERROR`.

**Límite por usuario.** `perUserLimit` (entero de 1 a 1000, por defecto 1) es el máximo de reservas
activas (`RESERVED` y no vencidas) que un usuario puede tener de ese cupón; al alcanzarlo, 409
`COUPON_LIMIT_REACHED`. Es seguro bajo concurrencia: dentro de la transacción se descuenta primero
`remainingUses` y después se cuentan las reservas activas del usuario; el conflicto de escritura sobre
el documento del cupón serializa las transacciones simultáneas.

### Ciclo de vida de la reserva

Cada reserva tiene `status` (`RESERVED` o `RELEASED`) y `expiresAt` (ahora + `RESERVATION_TTL_SECONDS`).

Reglas de aplicación (verificadas dentro de la transacción y con índices únicos parciales sobre las
reservas `RESERVED`):

- Un solo cupón activo por auditoría y por carrito (y usuario), sea el mismo código u otro, ya sea con
  `POST /coupons/apply` o con `couponCode` en `/pricing/calculate`: 409 `COUPON_ALREADY_APPLIED`.
  Liberar o dejar vencer la reserva libera el lugar.
- `POST /pricing/calculate` con `couponCode` comparte el límite de tasa por usuario de los cupones (429).
- Cada cupón tiene `currency` (por defecto `USD`, solo 3 letras mayúsculas); si difiere de la moneda de
  la auditoría o del carrito, 422 `CURRENCY_MISMATCH`. La moneda de productos y de `context.currency`
  también se valida como `^[A-Z]{3}$` tras pasar a mayúsculas.
- `POST /coupons/apply` rechaza auditorías más viejas que `AUDIT_QUOTE_TTL_SECONDS` con 409
  `AUDIT_STALE`: hay que recalcular el carrito.
- Nota: el bloque `coupon` de una auditoría es válido solo mientras su reserva siga activa (`RESERVED`
  y no vencida). La auditoría es inmutable y no cambia al liberar o vencer la reserva; quien consuma una
  auditoría como cotización debe comprobar el estado de la reserva (`coupon.reservationId`).

- `DELETE /api/v1/coupons/reservations/:id` (solo el dueño) devuelve la reserva a `RELEASED` y restaura
  exactamente un uso: 200 `{ status: "RELEASED", reservationId, remainingUses }`. Una reserva ajena o
  inexistente da 404 `RESERVATION_NOT_FOUND`; una ya liberada, 409 `RESERVATION_NOT_ACTIVE`.
- `releaseExpiredReservations(now)` libera las reservas vencidas de forma idempotente y nunca deja
  `remainingUses` por encima de `maxUses`. `src/server.ts` la ejecuta en un intervalo con `unref()`, así
  que no impide que el proceso termine. Una reserva vencida que aún no se barrió tampoco bloquea el
  mismo carrito ni cuenta para el límite por usuario.
- El índice único `{couponCode, cartId}` es parcial (solo `RESERVED`), por lo que un carrito puede
  reservar de nuevo el cupón después de liberarlo. En bases existentes, `initModels()` sincroniza los
  índices de reservas para reemplazar el índice único anterior.

### Catálogo de administración y respaldo

Todo bajo `/api/v1/admin`, requiere token de admin (401 sin token, 403 para clientes).

- `POST /campaigns` cuerpo: `code, name, type (percentage|fixed), value, priority, stackable, startsAt,
endsAt, isActive, conditions { minSubtotal, skus, categories, customerTiers, regions }`. 201, 409
  si el código está duplicado, 400 si es inválido (`endsAt <= startsAt`, porcentaje mayor a 100,
  campos desconocidos).
- `PATCH /campaigns/:code` actualización parcial (fechas, valor, `isActive`, conditions). `conditions`
  se mezcla campo por campo: las claves omitidas se conservan y una clave con `null` se borra. 404
  `CAMPAIGN_NOT_FOUND`.
- `GET /regions` lista cada región usada por alguna campaña con sus campañas (bandera `activeNow`), más
  las campañas `global` sin regiones. `PUT` / `DELETE /campaigns/:code/regions/:region` agregan o quitan
  una región de forma atómica (idempotente). Quitar la última región devuelve 409 `LAST_REGION`: una
  lista vacía haría que la campaña aplique en todas partes, así que mejor se desactiva.
- `POST /coupons` cuerpo: `code, discountType, value, maxUses, minSubtotal, expiresAt, isActive, userId?,
perUserLimit?` (1..1000, por defecto 1). `remainingUses` empieza en `maxUses`. `PATCH /coupons/:code`
  cambia `isActive`, `expiresAt`, `minSubtotal`, `perUserLimit`.
- `GET /products`, `POST /products` (`sku, name, category, unitPrice` en centavos, `currency` por defecto
  USD, `isActive`; `sku` se guarda en mayúsculas; 409 `PRODUCT_EXISTS`) y `PATCH /products/:sku` (subconjunto
  estricto y no vacío de `name, category, unitPrice, currency, isActive`; 404 `PRODUCT_NOT_FOUND`).
  `npm run seed` crea seis productos de ejemplo (`SKU-LAPTOP`, `SKU-PHONE`, `SKU-HEADPHONES`,
  `SKU-KEYBOARD`, `SKU-MOUSE`, `SKU-CABLE`).
- `GET /audits/:auditId` devuelve el snapshot más `checksumValid` (sha256 recalculado al leer, así que
  se detectan ediciones accidentales o simples hechas fuera de la API; ver Limitaciones conocidas).
  `GET /audits/export?format=csv|json&from=&to=` es el respaldo (fechas ISO, `from` no posterior a `to`,
  máximo 10000 filas, si no 422 `EXPORT_TOO_LARGE`; el CSV se envía como archivo adjunto con
  neutralización de inyección de fórmulas).
- Precios por región: envía `context.region` (por ejemplo `CN`) a `/pricing/calculate`; las campañas con
  `conditions.regions` aplican solo para esas regiones, y si no se omiten con `REGION_NOT_ELIGIBLE`. Los
  precios por temporada son solo rangos de fechas que el admin define cada año.

### GET /health

Devuelve el estado de la conexión a la base de datos (200 si está conectada, 503 si no).

Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el diseño y los diagramas de secuencia.
