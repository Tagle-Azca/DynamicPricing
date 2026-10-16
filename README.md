# Dynamic Pricing & Promotion Engine - Delivery 1

REST API (Node, TypeScript, Express, Mongoose, Zod) that provides:

1. **Rule-based price calculation** from MongoDB campaigns (`POST /api/v1/pricing/calculate`).
2. **Transactional coupon reservation** with no overselling (`POST /api/v1/coupons/apply`).
3. **Immutable pricing audit snapshots** (`GET /api/v1/pricing/audit/:auditId`).

All money values are integer cents.

## Install

```bash
npm install
cp .env.example .env
```

`.env` is gitignored. `.env.example` contains placeholders only:

```
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/dynamic_pricing?replicaSet=rs0&directConnection=true
```

## MongoDB (replica set required for transactions)

Local, with Docker (single-node replica set `rs0`, auto-initiated by the healthcheck):

```bash
docker compose up -d
```

MongoDB Atlas: create a cluster (replica set by default) and set `MONGODB_URI` to the
`mongodb+srv://...` connection string, including a database name such as `/dynamic_pricing`.

## Run

```bash
npm run seed   # idempotent: resets campaigns, coupons, reservations (never audits)
npm run dev    # tsx watch src/server.ts
npm run build && npm start
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm run format`, `npm run format:check`.

## Evidence

```bash
npm run evidence
```

Starts an in-memory MongoDB replica set (`mongodb-memory-server`, the binary is downloaded on first
run), seeds it, runs the app, issues real HTTP requests for 14 scenarios (including a 25-way
concurrency test, audit immutability and a `server.ts` boot/SIGINT smoke test), and writes
`docs/evidence/EVIDENCE.md`. Exit code is non-zero if any scenario fails.

## Endpoints

Success: `{ "data": ... }`. Error: `{ "error": { "code", "message", "details?" } }`.

### POST /api/v1/pricing/calculate

```bash
curl -X POST localhost:3000/api/v1/pricing/calculate -H 'content-type: application/json' -d '{
  "cartId": "cart-1",
  "items": [{ "sku": "SKU-1", "category": "electronics", "unitPrice": 2500, "quantity": 2 }],
  "context": { "userId": "user-1", "customerTier": "gold", "currency": "USD" }
}'
```

Returns `auditId, cartId, currency, subtotal, appliedRules[], skippedRules[], totalDiscount, total, calculatedAt`.

### GET /api/v1/pricing/audit/:auditId

```bash
curl localhost:3000/api/v1/pricing/audit/<uuid>
```

400 on malformed uuid, 404 `AUDIT_NOT_FOUND`, 200 with the snapshot and its sha256 `checksum`.

### POST /api/v1/coupons/apply

```bash
curl -X POST localhost:3000/api/v1/coupons/apply -H 'content-type: application/json' \
  -d '{ "code": "WELCOME10", "cartId": "cart-1", "subtotal": 20000 }'
```

Errors: 404 `COUPON_NOT_FOUND`, 409 `COUPON_UNAVAILABLE` / `COUPON_ALREADY_APPLIED` /
`COUPON_EXHAUSTED`, 422 `MIN_SUBTOTAL_NOT_MET`, 400 `VALIDATION_ERROR`.

### GET /health

Returns database connection state (200 when connected, 503 otherwise).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design and sequence diagrams.
