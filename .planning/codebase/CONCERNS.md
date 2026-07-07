# Codebase Concerns

**Analysis Date:** 2026-07-07

> Resolved since the April audit: public endpoints now have rate limiting (`server/src/middleware/rateLimit.ts` — global + auth/write/automation limiters); the unused `OtpVerification` model was dropped from the schema.

---

## Tech Debt

**`main_owner` role in schema but deprecated in code:**
- The `StaffRole` enum (`server/prisma/schema.prisma`) still contains `main_owner`; `resolveStaffFromToken` maps it → `admin` as a backward-compat shim (`server/src/middleware/auth.ts`, ~lines 41-47). `requireMainOwner` remains as a deprecated alias of `requireAdmin`.
- Fix: migrate any `main_owner` records to `admin`, drop the enum value, remove the shim and alias.

**QR "generate all" produces `/outlet/{code}` URLs:**
- `QRService.generateAll` builds `${baseUrl}/outlet/${o.code}` (legacy path) while `generateForOutlet` correctly uses `${baseUrl}/${code}` (the live dynamic route). Bulk-generated QR codes land on a 404.
- Files: `server/src/services/QRService.ts` (line ~37 vs ~18).
- Fix: change `generateAll` to `${this.baseUrl}/${o.code}`.

**Generated Prisma client is committed to git:**
- `server/generated/prisma/` is tracked and reappears in every `git status` after `prisma generate`.
- Fix: gitignore it and run `prisma generate` as a build/deploy step.

**`totalVisits` denormalized counter can drift:**
- `Customer.totalVisits` only increments when a visit has a linked `customerId`; anonymous visits and the 1-hour dedup window let it diverge from `COUNT(CustomerVisit)`.
- Fix: compute from `CustomerVisit` at query time, or add a reconciliation job.

**Orphaned legacy per-outlet components:**
- `client/main/src/components/{mumbai,pune,bangalore,delhi}/` and `menu/{mumbai,pune,bangalore,delhi}menu.tsx`, `menu/page1-4.tsx` predate the dynamic `[code]` route and are dead code. `map/mappage.tsx` and `social/socialpage.tsx` still hardcode outlet slugs.
- Fix: delete the dead trees; refactor map/social to fetch outlets from `GET /api/outlets`.

---

## Known Bugs

**QR "generate all" → 404 QR codes** (see above). Workaround: use single-outlet generation (`generateForOutlet`).

**Visit `customerId` stays null if the customer registers after first scan:**
- Anonymous `CustomerVisit` rows created before registration are never backfilled with the new `customerId`.
- Files: `server/src/routes/visits.ts`, `server/src/routes/customers.ts`.

**`[code]` dynamic route returns HTTP 200 for invalid outlet codes:**
- Shows an inline "Outlet not found" message but returns 200, bypassing Next.js 404 handling. `client/main/src/app/[code]/page.tsx`.

---

## Security Considerations

**No `helmet` / HTTP security headers:**
- Responses lack `X-Content-Type-Options`, `X-Frame-Options`, HSTS, CSP. `server/src/app.ts`.
- Fix: `app.use(helmet())`.

**A live third-party secret is checked into `.claude/settings.local.json`:**
- A prior permission entry embedded a real WaSenderAPI key and the automation secret in a `curl` command. Secrets in tracked config are exposed to anyone with repo access.
- Fix: rotate the WaSenderAPI key and `AUTOMATION_SECRET`; keep secrets out of settings/permission entries. (The settings file has been cleaned as part of this update.)

**WhatsApp send path is a "temporary testing" WaSenderAPI integration:**
- `server/src/lib/notifications.ts` sends plain-text WhatsApp via WaSenderAPI when `WASENDER_API_KEY` is set; the intended Twilio Meta-template path is still commented out. Plain-text sends outside an approved template can violate WhatsApp Business policy at scale.
- Fix: complete the Twilio Meta-template integration before high-volume campaigns, or confirm WaSenderAPI compliance.

**Device fingerprint is spoofable; phone re-registration reassigns `deviceId`:**
- Customer identity is a `localStorage` fingerprint; clearing storage or switching browsers allows re-registration, and the duplicate-phone handler silently reassigns `deviceId`. No OTP verification exists (the `OtpVerification` model was removed).
- Fix: add phone OTP verification at registration.

**CORS is effectively open when `CORS_ORIGINS` is empty:**
- `server/src/app.ts`: an empty `CORS_ORIGINS` makes `allowedOrigins.length === 0` true, allowing all origins — fine for dev, dangerous in production.
- Fix: throw on startup if `NODE_ENV === 'production'` and `CORS_ORIGINS` is empty/blank.

---

## Performance Bottlenecks

**Render free-tier cold start (~30s):** server spins down after ~15 min idle; first scan after idle stalls. Mitigate with a keep-warm ping or a paid tier.

**Outlet stats endpoint fans out many parallel queries per outlet** (`server/src/routes/cms/outlets.ts`) — connection-pool contention on Render free-tier Postgres. Fix: aggregate via `$queryRaw` or cache per outlet.

**Automation loop makes N sequential `findFirst` dedup calls per customer** (`server/src/routes/automation.ts`). Fix: preload the day's `AutomationLog` rows into an in-memory Set.

---

## Fragile Areas

**In-process SSE broker does not survive horizontal scaling:**
- `server/src/lib/orderEvents.ts` is a single-process `EventEmitter`. Correct for the current single Render instance, but a client on instance A would miss events emitted on instance B. Documented in the file.
- Safe change: swap to Postgres LISTEN/NOTIFY or Redis pub/sub behind the same `emitOrderEvent`/`onOrderEvent` interface.

**Cloudinary `public_id` derived by URL string parsing:**
- `server/src/routes/cms/menu.ts` extracts `public_id` by splitting the URL; any Cloudinary URL-format change silently skips deletion and leaks storage.
- Safe change: persist the `public_id` returned by upload on the `MenuItem` record.

---

## Missing Features / Gaps

**No soft-delete for menu items:** `MenuItem` has `isAvailable` but item deletion is a hard delete (and drops the Cloudinary image); categories use soft-delete. Consider soft-delete for order-history integrity — though `OrderItem` already snapshots name/price and nullifies `menuItemId` on delete.

**Phone OTP verification not implemented** (model removed) — customer registration has no verification.

---

## Test Coverage Gaps

**No test suite exists** anywhere (`server/`, both clients). High-priority targets now include the new order path:
- `server/src/lib/orders.ts` — price snapshotting, variant resolution, daily-token allocation under concurrency
- `server/src/routes/orders.ts` / `routes/cms/orders.ts` — status transitions, cancel rules, SSE auth
- `server/src/routes/visits.ts` — 1-hour dedup
- `server/src/middleware/auth.ts` — role guards, `main_owner` mapping, SSE token auth
- `client/main/src/lib/validators.ts` — form schemas

---

*Concerns audit: 2026-07-07*
