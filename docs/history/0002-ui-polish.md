---
id: 0002
date: 2026-11-24
type: refactor
status: accepted
branch: ui-polish
run: 20261124-ui-polish
checkpoint: ae7ecbb
supersedes:
superseded-by:
summary: Polish the web UI: plain-language rules, admin tabs, confirmations
---

# 0002. UI polish

## Request

Make the UI more intuitive with better UX.

## Why (context and problem)

The browser check of the catalog run showed a working but dense UI: raw rule codes, one long admin page, hidden "New" forms, no confirmation on deactivate, technical ids up front.

## Decision

- Public/ only, no API change. Reason: keep the security-reviewed backend untouched.
- Keep strict CSP, textContent only, JWT in memory. Reason: earlier Hacker review passed on these.
- In-page confirmation instead of window.confirm. Reason: CSP-friendly and testable.

## Alternatives considered

Full redesign rejected: high cost, no backend marks, risk to the CSP rules.

## What changed

- Skipped rules shown as plain text in a collapsed section.
- Admin split into tabs: Map and Campaigns, Coupons, Products, Audits.
- Visible "+ New" buttons; in-page confirm for deactivate actions.
- Cart and audit ids moved into a Details section; loading states on buttons.
  Files: public/index.html, public/styles.css, public/js/\*, tests/ui.test.ts.

## Consequences

The collapsed sections have no visible arrow. The 360 px layout was not verified in a browser.

## Verification

DoD-1..8 PASS by gate (130 tests, lint, format, standards 0 fail) and a Chrome check at 1920 px. 360 px: CSS media rules read only.

## Where to change this later

Admin tabs and confirm dialog live in public/js. Handle: "the admin tabs" or "the deactivate confirmation".
