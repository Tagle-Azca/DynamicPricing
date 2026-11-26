---
id: 0001
date: 2026-11-24
type: security
status: accepted
branch: server-catalog-coupons
run: 20261124-server-catalog-coupons
checkpoint: ade7a72
supersedes:
superseded-by:
summary: Server-side catalog, coupon lifecycle and per-user cap, coupon in calculate
---

# 0001. Server-side catalog and coupon lifecycle

## Request

Finish the project: close the pending delivery items and the price-tampering gap found in the audit.

## Why (context and problem)

The client sent `unitPrice` and the coupon `subtotal`, so prices could be forged. Coupon reservations never expired and one account could drain a global coupon.

## Decision

- Prices come only from a Product collection; items are `{sku, quantity}` (strict). Reason: server is the source of truth.
- Coupon is applied inside `/pricing/calculate` in one transaction with the audit write. Reason: no client-supplied subtotal.
- `/coupons/apply` takes `{code, auditId}`; one active coupon per audit and per cart; stale audits rejected (AUDIT_QUOTE_TTL_SECONDS).
- Reservations have status and expiry, a DELETE endpoint and a sweeper; `perUserLimit` per coupon; coupons carry a currency.
- Audit checksum includes the coupon only when present, so old audits still verify.
- Docs stay in Spanish, code in English (project rule).

## Alternatives considered

Refresh tokens and taxes were left out of scope. Fixing S2 in code was rejected (no checkout exists yet); it is documented instead.

## What changed

- Catalog endpoints and admin product CRUD; storefront reads /catalog.
- Coupon lifecycle, per-user cap, currency check, rate limit on calculate with couponCode.
- OpenAPI spec with a route-coverage test; evidence runner now 46 scenarios; 123 tests.
  Files: src/services/coupon._.ts, src/services/pricing.service.ts, src/models/product.model.ts, docs/openapi.yaml, public/js/_.

## Consequences

S2: an audit's coupon block stays visible after release/expiry (documented). S6: a DB already holding duplicate RESERVED reservations fails the index build at startup; clean reservations first. Taxes, coupon events, token revocation remain pending.

## Verification

All DoD-1..11 PASS (Manager review). Gate: format, lint, typecheck, 123 tests, evidence 46/46, standards 0 fail. UI not exercised in a browser.

## Where to change this later

Coupon rules: src/services/coupon.reserve.ts and coupon.release.ts. Price resolution: src/services/pricing.service.ts. Handle: "the catalog" or "the coupon lifecycle".
