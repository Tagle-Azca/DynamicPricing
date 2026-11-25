---
id: 0003
date: 2026-11-25
type: feat
status: accepted
branch: shop-redesign-checkout
run: 20261125-shop-redesign-checkout
checkpoint: 47f03aa
supersedes:
superseded-by:
summary: Redesign the shop, add a checkout page with orders, shipping and server-side tier
---

# 0003. Shop redesign and checkout

## Request

Redesign the customer shop (light theme, product grid with images, campaign banner, cart drawer) and move checkout to its own page, keeping the server as the source of truth for every price.

## Why (context and problem)

The shop was a plain list on a dark admin-style page. A real checkout needed things the API did not have: an order write path, shipping, a trustworthy customer tier (the client used to send `customerTier`, so any user could claim a better tier), campaign data for a banner, and product images. A startup crash on existing dev databases (old `couponCode_1_cartId_1` index) also had to be fixed.

## Decision

- Orders: `POST /orders` takes only an `auditId`, contact and address. The server re-prices the audit and rejects stale, changed, mismatched or foreign audits. Coupon reservation becomes `CONSUMED` in the same transaction as the order. One order per audit (idempotent replay). Card data is never accepted.
- Shipping is server config (Standard, Express, Standard free from 100.00 after discounts). `calculate` returns `shippingOptions`, `shipping`, `grandTotal`; the audit checksum includes `shipping` only when present, so old audits verify.
- Tier lives on the user and is read server-side from the audit owner; the client value is ignored.
- The client never does money math: the server returns `lineTotal`, `savings`, `nextThreshold` (`remaining`, `progressPercent`). Only `money.js` divides by 100, to format.
- Images: optional `imageUrl`, only `https://res.cloudinary.com/<cloud>/image/upload/...`, fail-closed when the cloud name is unset; CSP `img-src` is scoped to that cloud path.
- Fonts are self-hosted (`public/fonts`) to keep the CSP strict.
- Same-code coupon re-quote on the same cart releases and reserves atomically, so changing delivery or region never leaks a use.

## Alternatives considered

- Client-side progress and line totals: rejected (breaks the source-of-truth rule).
- Google Fonts CDN: rejected (third party, looser CSP).
- Tier in the JWT: rejected (changes would not apply until re-login).
- Client picks the price at order time: rejected; the order only honours the audited price.

## What changed

- New light-theme shop (banner with live progress, product cards, stepper, cart drawer) and `#/checkout` with three accordion steps, coupon box and a confirmation view.
- New API: `POST /orders`, `GET /campaigns/active`, shipping and quote fields in `calculate`, product `imageUrl`, user `tier`, `npm run set-tier`.
- Startup migration replaces the legacy coupon reservation index without touching data.
- Fix round: banner envelope bug, campaign sort, admin-on-behalf tier, legacy coupon vs order price mismatch, Cloudinary fetch URLs, coupon holds on stale apply and on logout.

Files: `src/services/order.*.ts`, `src/services/pricing.*.ts`, `src/config/shipping.ts`, `src/models/order.model.ts`, `src/models/reservationIndexes.ts`, `public/js/{checkout,quote,drawer-controller,banner,money}.js`, `public/styles.css`, `docs/openapi.yaml`, `docs/FRONTEND.md`.

## Consequences

- Orders are demo only (no payment, no email). A real payment provider would need its own step.
- Open, Low or info: legacy `/coupons/apply` can still reserve on an already-ordered audit; `TRUST_PROXY=true` lets clients spoof IPs (pre-existing); tier-only campaign codes show in skipped rules; CSP `style-src` and `font-src` keep helmet defaults; coupon reservation uniqueness per cart is global.
- Not checked in a real browser: coupon apply and remove, logout release, Admin tabs after the rewrite, 360 px.

## Verification

All [DoD-1..14] PASS (Manager review). Gate on the final revision: format, lint, typecheck clean; 239 tests pass; evidence 52/52; standards 0 fail, 2 soft size warnings. Hacker: 0 Critical, High or Medium. Overall: PASS.

## Where to change this later

- Shipping prices and free threshold: `src/config/shipping.ts` ("the shipping rates").
- Order rules: `src/services/order.place.ts` and `order.reprice.ts` ("the order checks").
- Image host rule: `src/services/imageUrl.ts` ("the Cloudinary check").
- Banner text and progress: `public/js/campaigns.js`, `public/js/banner.js`.
- Checkout steps: `public/js/steps.js`, `step-*.js`; theme: `public/styles.css`.
