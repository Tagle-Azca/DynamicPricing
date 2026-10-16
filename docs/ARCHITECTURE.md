# Architecture

## Layers

```mermaid
flowchart LR
  Client --> Routes
  subgraph Express app
    Routes --> Validate[validate middleware - zod]
    Validate --> Controllers
    Controllers --> Services
    Services --> Rules[pricing.rules - pure math]
    Services --> Models
    ErrorHandler[errorHandler + AppError]
  end
  Models --> MongoDB[(MongoDB replica set)]
  Controllers -. errors .-> ErrorHandler
  Services -. errors .-> ErrorHandler
```

Request flow: Client -> Route -> Controller -> Service -> Model -> MongoDB -> Response.

- Routes bind paths to zod validation and controllers.
- Controllers handle HTTP only: they never import models and hold no domain logic.
- Services hold orchestration and domain logic and never import express.
- `pricing.rules.ts` is pure, deterministic math (no I/O); `now` is injectable.
- Models are Mongoose schemas; `pricing_audits` is immutable via schema hooks.
- The global error handler maps `ZodError`, `AppError`, bad JSON and duplicate keys to the
  `{ error: { code, message, details? } }` envelope.

## Sequence: POST /api/v1/pricing/calculate

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Route + zod
  participant K as PricingController
  participant S as PricingService
  participant E as pricing.rules
  participant A as AuditService
  participant DB as MongoDB
  C->>R: POST /pricing/calculate
  R->>K: validated body
  K->>S: calculatePricing(request)
  S->>DB: Campaign.find(active, startsAt<=now<endsAt)
  DB-->>S: campaigns
  S->>E: evaluateCampaigns(campaigns, items, context)
  E-->>S: applied/skipped rules, totals
  S->>A: recordAudit(request, result)
  A->>DB: insert pricing_audits (sha256 checksum)
  S-->>K: response with auditId
  K-->>C: 200 { data }
```

## Sequence: POST /api/v1/coupons/apply (transaction)

```mermaid
sequenceDiagram
  participant C as Client
  participant K as CouponController
  participant S as CouponService
  participant DB as MongoDB
  C->>K: POST /coupons/apply (validated)
  K->>S: applyCoupon(request)
  S->>DB: startSession
  S->>DB: withTransaction begin
  S->>DB: findOne coupon (session)
  S->>DB: findOne reservation (session)
  S->>DB: findOneAndUpdate remainingUses>0, $inc -1 (session)
  alt no document matched
    S-->>K: AppError 409 COUPON_EXHAUSTED (transaction aborted)
  else matched
    S->>DB: insert CouponReservation (session)
    S->>DB: commit
    S-->>K: RESERVED
  end
  S->>DB: endSession (finally)
  K-->>C: 200 { data } or error envelope
```

Write conflicts from concurrent transactions are transient errors that `withTransaction` retries,
so `remainingUses` can never go below zero and reservations never exceed `maxUses`.

## Sequence: GET /api/v1/pricing/audit/:auditId

```mermaid
sequenceDiagram
  participant C as Client
  participant R as Route + zod
  participant K as AuditController
  participant S as AuditService
  participant DB as MongoDB
  C->>R: GET /pricing/audit/:auditId
  R-->>C: 400 if not a uuid
  R->>K: validated params
  K->>S: getAudit(auditId)
  S->>DB: PricingAudit.findOne({ auditId })
  alt missing
    S-->>C: 404 AUDIT_NOT_FOUND
  else found
    S-->>K: snapshot with checksum
    K-->>C: 200 { data }
  end
```

## Immutability

`pricing_audits` paths are `immutable: true`, schema is `strict: 'throw'`, and pre-hooks on every
update, replace, delete, bulkWrite and document-level update/delete/re-save throw
`AppError(409, AUDIT_IMMUTABLE)`. The checksum is the sha256 of the canonical (sorted-key) JSON of
`{ auditId, cartId, context, items, result }`. (Writes made outside Mongoose, directly against the
database, are not blocked at this layer.)
