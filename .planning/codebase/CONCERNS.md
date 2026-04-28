# Codebase Concerns

**Analysis Date:** 2026-04-28

---

## Tech Debt

**Orphaned outlet-specific components (static menu era):**
- Issue: The old per-outlet page architecture (`boisar/`, `palghar/`, `vasai/`, `virar/` routes) was deleted and replaced with a dynamic `[code]/` route, but the underlying UI components and static menu data files were NOT removed.
- Files:
  - `client/main/src/components/boisar/boisar.tsx`
  - `client/main/src/components/palghar/palghar.tsx`
  - `client/main/src/components/vasai/vasai.tsx`
  - `client/main/src/components/virar/virar.tsx`
  - `client/main/src/components/menu/boisarmenu.tsx`
  - `client/main/src/components/menu/palgharmenu.tsx`
  - `client/main/src/components/menu/vasaimenu.tsx`
  - `client/main/src/components/menu/virarmenu.tsx`
  - `client/main/src/components/menu/page1.tsx` through `page4.tsx`
  - `client/main/src/components/map/mappage.tsx` (hardcodes outlet slugs)
  - `client/main/src/components/social/socialpage.tsx` (hardcodes `OUTLET_SLUGS`)
- Impact: Dead code (~1,200+ lines) that confuses future developers. `mappage.tsx` and `socialpage.tsx` still hardcode outlet slugs instead of fetching from API, making them break if outlets are added or renamed.
- Fix approach: Delete orphaned per-outlet component trees. Refactor `mappage.tsx` and `socialpage.tsx` to fetch outlets dynamically from `GET /api/outlets`.

**`main_owner` role in schema but deprecated in code:**
- Issue: The `StaffRole` enum in `server/generated/prisma/schema.prisma` still contains `main_owner`. The auth middleware maps it to `admin` at runtime as a backwards-compat shim (comment: "Map deprecated main_owner → admin").
- Files: `server/src/middleware/auth.ts` (lines 52-57), `server/generated/prisma/schema.prisma` (line 57)
- Impact: Confusion over the role model. Any new staff created with `main_owner` silently works but the role is semantically dead.
- Fix approach: Migrate any remaining `main_owner` DB records to `admin`, remove the enum value from schema, and delete the shim in `auth.ts`.

**`OtpVerification` model is unused:**
- Issue: `server/generated/prisma/schema.prisma` defines a full `OtpVerification` model with phone, OTP, expiry, and `used` flag — but no route in `server/src/` reads or writes this table.
- Files: `server/generated/prisma/schema.prisma` (lines 216-226)
- Impact: Dead schema weight; migrations carry this table indefinitely.
- Fix approach: Either implement phone-OTP verification for the customer form (desired feature) or drop the model in the next migration.

**`totalVisits` denormalized counter can drift:**
- Issue: `Customer.totalVisits` is incremented only when a visit is recorded via `POST /visits` AND a `customerId` is present. Anonymous visits (no linked customer) and the 1-hour dedup window mean `totalVisits` can diverge from `COUNT(CustomerVisit)` for that customer.
- Files: `server/src/routes/visits.ts` (lines 36-44), `server/generated/prisma/schema.prisma` (Customer model)
- Impact: CMS dashboard and CSV export show incorrect visit counts for customers who scanned before registering.
- Fix approach: Either remove `totalVisits` and compute from `CustomerVisit` at query time, or add a nightly reconciliation job.

**QR URL pattern mismatch in `QRService`:**
- Issue: `QRService.generateAll` constructs URLs as `${baseUrl}/outlet/${code}` (legacy path — line 38) while `generateForOutlet` correctly uses `${baseUrl}/${code}` (new dynamic route — line 18). Bulk QR generation produces codes pointing to non-existent `/outlet/BSR` style paths.
- Files: `server/src/services/QRService.ts` (lines 18 vs 38)
- Impact: QR codes from the CMS "download all" batch route land on a 404.
- Fix approach: Change `generateAll` line 38 to use `` `${this.baseUrl}/${o.code}` `` to match `generateForOutlet`.

**Outlet stats endpoint runs N×12 parallel DB queries:**
- Issue: `GET /api/cms/outlets/stats` fires 12 independent Prisma queries per outlet inside a `Promise.all(outlets.map(...))`. For 4 outlets this is 48 simultaneous queries to a single Render free-tier Postgres instance.
- Files: `server/src/routes/cms/outlets.ts` (lines 81-136)
- Impact: Connection pool contention; likely the primary cause of slow dashboard loads on Render.
- Fix approach: Replace with aggregated SQL via `$queryRaw` or cache stats for 5 minutes per outlet using an in-process TTL Map.

**`automation.ts` processes all customers in memory:**
- Issue: `runAutomation()` calls `prisma.customer.findMany({ where: { email: { not: null } } })` with no pagination, loading every customer record into the Node process at once.
- Files: `server/src/routes/automation.ts` (lines 100-111)
- Impact: Memory spike proportional to customer count. Render free tier has 512 MB RAM; will OOM at a few thousand customers.
- Fix approach: Process customers in pages (`take: 200` with cursor pagination) or stream with `findManyAndCount`.

**Generated Prisma client is committed to git:**
- Issue: `server/generated/` (including `index.js`, `edge.js`, `index.d.ts`, `schema.prisma`) is tracked in git and appears in every `git status` after `prisma generate`.
- Files: `server/generated/prisma/`
- Impact: Noisy diffs, merge conflicts, and inflated repo size on every schema change.
- Fix approach: Add `server/generated/` to `.gitignore` and run `prisma generate` as a build step in CI and on Render deploy command.

---

## Known Bugs

**QR "generate all" produces 404 QR codes:**
- Symptoms: Scanning a QR code downloaded via CMS bulk export lands on a 404 page.
- Files: `server/src/services/QRService.ts` (line 38)
- Trigger: CMS QR page → "Download All QRs" → scan any generated code.
- Workaround: Use single-outlet QR generation from the CMS, which calls `generateForOutlet` and is correct.

**Visit `customerId` stays null if customer registers after first scan:**
- Symptoms: A user scans the QR → anonymous `CustomerVisit` created (no `customerId`). User fills the form → customer record created. The pre-existing visit record is never backfilled with the new `customerId`.
- Files: `server/src/routes/visits.ts` (POST /visits), `server/src/routes/customers.ts` (POST /customers)
- Trigger: Every new customer who scans the QR before filling the registration form.
- Workaround: None; historical anonymous visits remain permanently unlinked.

**`[code]` dynamic route returns HTTP 200 for invalid outlet codes:**
- Symptoms: Visiting `/{invalidCode}` shows an inline "Outlet not found" message but returns a 200 status code, bypassing Next.js 404 handling.
- Files: `client/main/src/app/[code]/page.tsx` (line 56-62)
- Trigger: Any URL with a code not in the database.
- Workaround: None; bots and scrapers will see 200 for all paths.

---

## Security Considerations

**No rate limiting on public endpoints:**
- Risk: `POST /api/customers`, `POST /api/visits`, and `POST /api/reviews` are unauthenticated and have no rate limiting. Scripts can spam customer registrations or flood the visits table.
- Files: `server/src/app.ts`, `server/src/routes/customers.ts`, `server/src/routes/visits.ts`
- Current mitigation: Visit dedup logic (1 per device per hour) provides minimal protection for visits only; customer creation has none.
- Recommendations: Add `express-rate-limit` middleware to all public routes (5 req/min for POST /customers, 20 req/min for POST /visits).

**No `helmet` or HTTP security headers:**
- Risk: Responses lack `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, and `Content-Security-Policy` headers.
- Files: `server/src/app.ts`
- Current mitigation: Render TLS termination only.
- Recommendations: Add `npm install helmet` and `app.use(helmet())` in `createApp()`.

**Device fingerprint is spoofable; phone hijack possible:**
- Risk: Customer identity is tied to `FingerprintJS` `visitorId` stored in `localStorage`. A user who clears storage or uses a different browser can register again with the same phone number. The duplicate-phone handler in `POST /customers` then silently reassigns `deviceId` to the new device, de-linking the legitimate customer.
- Files: `client/main/src/lib/fingerprint.ts`, `server/src/routes/customers.ts` (lines 78-92)
- Current mitigation: Phone uniqueness constraint catches duplicates but silently reassigns rather than rejecting.
- Recommendations: Add phone OTP verification at registration (the `OtpVerification` model already exists in schema).

**CORS is fully open in local/misconfigured environments:**
- Risk: `server/src/app.ts` line 35: if `CORS_ORIGINS` env var is unset, `allowedOrigins` is `['']` and `allowedOrigins.length === 0` is false, but any origin not in the list hits the error path. However in pure local dev (no env var set), `allowedOrigins.length` is 1 (contains `''`), so the `=== 0` guard does not fire — yet all origins pass because `allowedOrigins.includes(origin)` is always false and there is a separate `!origin` pass-through for same-origin requests. The net effect is locally all cross-origin requests are rejected unless `CORS_ORIGINS` is correctly configured.
- Files: `server/src/app.ts` (lines 27-43)
- Recommendations: Add a startup check that throws if `NODE_ENV === 'production'` and `CORS_ORIGINS` is empty or contains only blank strings.

---

## Performance Bottlenecks

**Render free-tier cold start (~30 seconds):**
- Problem: Server spins down after 15 minutes of inactivity; first customer QR scan after idle waits up to 30 seconds.
- Files: N/A — deployment infrastructure.
- Cause: Render free tier spin-down policy.
- Improvement path: Add a UptimeRobot or Cloudflare Worker cron ping every 10 minutes to keep the server warm, or upgrade to Render paid tier ($7/month).

**Automation loop makes N sequential `findFirst` calls per customer:**
- Problem: `runAutomation()` calls `alreadySent()` (a DB `findFirst`) up to 6 times per customer in a `for` loop with no batching.
- Files: `server/src/routes/automation.ts` (lines 115-216)
- Cause: One dedup check per automation type, per customer, per stage.
- Improvement path: Preload the day's `AutomationLog` records for all customers in one query before the loop and check against an in-memory Set.

---

## Fragile Areas

**Cloudinary `public_id` derived by URL string parsing:**
- Files: `server/src/routes/cms/menu.ts` (lines 155-167, 194-204, 239-249)
- Why fragile: Image deletion extracts the Cloudinary `public_id` by splitting the URL string and skipping version segments. Any Cloudinary URL format change (named transformations, subfolders, CDN rewrites) silently skips deletion, leaking storage.
- Safe modification: Store the `public_id` returned by `cloudinary.uploader.upload_stream` directly on the `MenuItem` record in a dedicated `imagePublicId` column instead of re-deriving it.

**`automation.ts` auth logic is duplicated three times:**
- Files: `server/src/routes/automation.ts` (lines 19-35, 249-258, 307-314)
- Why fragile: The worker-secret guard is copy-pasted as `requireWorkerSecret`, an inline anonymous function, and the `dualAuth` helper, each with slightly different behaviour (one allows dev-mode bypass, the others do not).
- Safe modification: Consolidate into a single `dualAuth` middleware used everywhere.

---

## Missing Critical Features

**No image upload control in CMS menu editing workflow:**
- Problem: Backend endpoints `POST /api/cms/menu/items/:id/image` and `DELETE /api/cms/menu/items/:id/image` are fully implemented, but the menu editing UI at `client/cms/src/app/(cms)/menu/page.tsx` has no image upload widget. Image management exists only in the separate `client/cms/src/app/(cms)/media/page.tsx`.
- Blocks: Staff must leave the menu page entirely to manage item photos.

**Phone OTP verification not implemented:**
- Problem: The `OtpVerification` schema model exists but no route creates or validates OTPs. Customer phone registration has zero verification.
- Blocks: Any phone number can be used to register; fake customers are trivially created.

**No soft-delete for menu items:**
- Problem: `DELETE /api/cms/menu/items/:id` performs a hard `prisma.menuItem.delete()`. Categories use `isActive: false` soft-delete, items do not.
- Files: `server/src/routes/cms/menu.ts` (lines 150-173)
- Blocks: Deleted items are gone from history permanently; no undo path. Also deletes the Cloudinary image immediately.
- Fix approach: Add `isActive Boolean @default(true)` to `MenuItem` model and switch the DELETE route to set `isActive: false`.

---

## Test Coverage Gaps

**No test suite exists:**
- What's not tested: All server routes, middleware, automation date logic, Cloudinary image handling, dedup behaviour, and all Next.js pages.
- Files: Entire `server/src/` and `client/` directory trees.
- Risk: Any route refactor, schema change, or role logic update can silently break production.
- Priority: High — especially for:
  - `server/src/routes/customers.ts` (upsert + duplicate-phone edge case)
  - `server/src/routes/automation.ts` (date math, dedup check, multi-stage logic)
  - `server/src/middleware/auth.ts` (role guard, `main_owner` mapping)
  - `server/src/services/QRService.ts` (URL construction correctness)

---

*Concerns audit: 2026-04-28*
