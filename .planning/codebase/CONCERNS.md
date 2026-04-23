# Codebase Concerns

**Analysis Date:** 2026-04-24

---

## Tech Debt

**Prisma schema split — wrong file is nearly empty:**
- Issue: `server/prisma/schema.prisma` contains only a generator stub with no models, no enums, no datasource URL. The real schema (212 lines, all models) lives in `server/generated/prisma/schema.prisma`. Running `npx prisma generate` from the standard working directory would target the stub and produce a useless client.
- Files: `server/prisma/schema.prisma`, `server/generated/prisma/schema.prisma`
- Impact: Any developer following standard Prisma docs will silently generate an empty client. Migrations also require manual redirection.
- Fix approach: Either consolidate to one schema file or add a prominent README note and update `prisma.config.ts` to point explicitly at `server/generated/prisma/schema.prisma`.

**`main_owner` role is deprecated but still in DB enum and auth middleware:**
- Issue: `StaffRole` enum in `server/generated/prisma/schema.prisma` retains `main_owner` marked `@deprecated`. The auth middleware at `server/src/middleware/auth.ts:54` maps it to `admin` for backward compat. No migration removes it.
- Files: `server/generated/prisma/schema.prisma`, `server/src/middleware/auth.ts`
- Impact: Any `main_owner` rows in the DB silently become `admin`. This is intentional but the deprecated enum value will never be cleaned up without an explicit migration.
- Fix approach: Write a Prisma migration that updates all `main_owner` rows to `admin`, then remove the enum value and the compat branch in `requireAuth`.

**`requireMainOwner` middleware is deprecated but still exported:**
- Issue: `server/src/middleware/auth.ts:102` exports `requireMainOwner` marked `@deprecated` — it simply delegates to `requireAdmin`. No routes currently use it but it adds surface area.
- Files: `server/src/middleware/auth.ts`
- Fix approach: Grep all routes for `requireMainOwner` usage, confirm zero, then delete the export.

**Hardcoded per-outlet menu components not driven by the DB menu system:**
- Issue: `client/main/src/components/menu/virarmenu.tsx`, `boisarmenu.tsx`, `vasaimenu.tsx`, `palgharmenu.tsx` each export static arrays of menu items hardcoded in TypeScript. These are completely disconnected from the `MenuCategory` / `MenuItem` DB tables managed via the CMS.
- Files: `client/main/src/components/menu/virarmenu.tsx`, `client/main/src/components/menu/boisarmenu.tsx`, `client/main/src/components/menu/vasaimenu.tsx`, `client/main/src/components/menu/palgharmenu.tsx`, `client/main/src/app/boisar/menu/page.tsx`
- Impact: Menu changes made in the CMS are not reflected on the public-facing site for any outlet using these components. Only the dynamic `client/main/src/app/outlet/[code]/menu/page.tsx` route reads from the API.
- Fix approach: Replace all hardcoded menu arrays with API-driven data using the `GET /api/menu?outletId=` endpoint, matching the pattern already used in `client/main/src/app/outlet/[code]/menu/page.tsx`.

**`outletConfig` in `client/main` hardcodes outlet slugs and `hasMenu` flag:**
- Issue: `client/main/src/lib/outletConfig.ts` hardcodes four outlet slugs (boisar, palghar, virar, vasai) and whether each has a menu. Adding a new outlet requires a code change.
- Files: `client/main/src/lib/outletConfig.ts`, `client/main/src/app/outlet/[code]/menu/page.tsx:97`
- Impact: New outlet go-live requires a frontend deploy in addition to a DB insert.
- Fix approach: Derive `hasMenu` dynamically by checking whether the outlet has any active `MenuCategory` rows, removing the need for `outletConfig` entirely.

**`normalizePone` function has a typo in its name:**
- Issue: `server/src/routes/automation.ts:37` defines `normalizePone` (missing an 'h'). It is used in two places within the same file.
- Files: `server/src/routes/automation.ts`
- Impact: Low — purely cosmetic, but will cause confusion when the automation module is extended.
- Fix approach: Rename to `normalizePhone` in both definition and call sites.

---

## Security Considerations

**`AUTOMATION_SECRET` defaults to `change-me-before-deploy`:**
- Risk: If deployed without changing the secret, any caller who knows the default value can trigger the full automation run (birthday/anniversary/reengagement sends for all customers) without authentication.
- Files: `server/.env`, `server/src/routes/automation.ts:18`, `worker/wrangler.toml`
- Current mitigation: The check is present in `requireWorkerSecret` — if the env var matches the header, the request proceeds. The only protection is that the default value must be changed.
- Recommendations: Add a server startup assertion (`if (secret === 'change-me-before-deploy') throw new Error(...)`) that hard-fails at boot unless the value has been customized.

**CORS allows only localhost — no production domains configured:**
- Risk: Once the API is deployed to `api.stoneoven.in`, browser requests from `stoneoven.in` and the CMS domain will be blocked unless `CORS_ORIGINS` is updated.
- Files: `server/src/app.ts:25`, `server/.env`
- Current mitigation: None — the env var must be set manually before go-live.
- Recommendations: Document required `CORS_ORIGINS` value in a `.env.example` file. Production value should include `https://stoneoven.in`, `https://www.stoneoven.in`, and the CMS subdomain.

**Public customer registration endpoint has no rate limiting:**
- Risk: `POST /api/customers` and `POST /api/reviews` are unauthenticated and have no rate limiting. A script could flood the customers table with fake entries or spam reviews.
- Files: `server/src/routes/customers.ts`, `server/src/routes/reviews.ts`, `server/src/app.ts`
- Current mitigation: Zod validation rejects malformed payloads; phone uniqueness constraint limits duplicate phones. No IP-level or token-bucket rate limiting exists.
- Recommendations: Add `express-rate-limit` on public write routes before production launch.

---

## Schema / Type Mismatches

**`Outlet.location` is nullable in DB but typed as non-nullable in frontend:**
- Issue: DB schema (`server/generated/prisma/schema.prisma:65`) declares `location String?`. The TypeScript type in `client/main/src/types/outlet.ts:6` declares `location: string` (non-nullable). Similarly `address` is `String?` in DB but typed `address: string` in the frontend type.
- Files: `client/main/src/types/outlet.ts`, `server/generated/prisma/schema.prisma`
- Impact: If any outlet row has a null `location`, the CMS and public pages will render `"null"` or throw a runtime error. `client/main/src/app/outlet/[code]/page.tsx:122` renders `{outlet.location}` directly with no null guard.
- Fix approach: Update `client/main/src/types/outlet.ts` to `location: string | null` and `address: string | null`, then add null guards at render call sites.

**`Staff.username` is nullable in DB — staff with null username cannot log in:**
- Issue: `server/generated/prisma/schema.prisma:198` declares `username String?`. The CMS login flow (`server/src/routes/auth.ts`) uses Supabase Auth (email + password), so `username` is not directly used for login itself — but if any code path attempts to read `staff.username` without a null guard, it will fail silently or throw.
- Files: `server/generated/prisma/schema.prisma`, `server/src/routes/auth.ts`
- Impact: Staff created without running the setup script will have `username = null`. Any UI element displaying the username will render nothing or crash.
- Fix approach: Add a non-null assertion or fallback (`staff.username ?? staff.email`) wherever `username` is displayed in the CMS.

---

## Missing Infrastructure

**No test suite exists anywhere in the project:**
- Issue: Zero `.test.ts`, `.spec.ts`, or `.test.tsx` files exist across `server/`, `client/main/`, `client/cms/`, or `worker/`. No test runner is configured in any `package.json`.
- Files: All `package.json` files
- Impact: No regression protection on auth middleware, RBAC logic, automation date calculations, or API contract. Any refactor proceeds entirely without a safety net.
- Priority: High — especially for `server/src/middleware/auth.ts`, `server/src/routes/automation.ts`, and the `requireWorkerSecret` guard.
- Fix approach: Add Vitest to `server/` and write unit tests for `requireAuth`, `requireAdmin`, `normalizePone`, `alreadySent`, and the automation date logic. Add at minimum integration tests for the `POST /api/customers` upsert edge case (phone collision handling).

---

## Automation Concerns

**All Twilio and Resend credentials are commented out — automation is DRY_RUN only:**
- Issue: `server/src/lib/notifications.ts` has all actual send logic commented out. `DRY_RUN` mode is active whenever `TWILIO_ACCOUNT_SID` or `RESEND_API_KEY` are absent from env. All automation logs record `success` in DRY_RUN even though no message was sent.
- Files: `server/src/lib/notifications.ts`, `server/.env`
- Impact: The automation system appears functional (logs populate, CMS shows sent counts) but no customer has ever received a WhatsApp or email in production.
- Fix approach: Provision Twilio account + Meta WhatsApp template approval, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` in env, and uncomment the Twilio block. Same for Resend. Consider adding a `DRY_RUN` log distinction in automation log status so test runs are distinguishable from real sends.

**Automation only targets customers with non-null email:**
- Issue: `server/src/routes/automation.ts:99` filters `where: { email: { not: null } }` — customers who registered without an email are entirely excluded from all automation, including birthday WhatsApp which does not require email.
- Files: `server/src/routes/automation.ts`
- Impact: WhatsApp birthday/anniversary messages are never sent to customers who skipped the optional email field during registration.
- Fix approach: Split the customer query — fetch all customers for WhatsApp automation, fetch only email-having customers for email automation.

**Cloudflare Worker `account_id` is hardcoded in wrangler.toml:**
- Issue: `worker/wrangler.toml:5` contains a literal Cloudflare account ID (`11de51483dbed991a23c44341f0ca00d`). This is not a secret (account IDs are semi-public) but it ties the worker to a specific account and cannot be overridden per environment.
- Files: `worker/wrangler.toml`
- Impact: Low security risk; operational concern if account ownership changes.

---

## Test Coverage Gaps

**RBAC middleware not tested:**
- What's not tested: `requireAuth`, `requireAdmin`, `requireOwnerOrAbove` — including the `main_owner → admin` mapping and franchise owner outlet scoping.
- Files: `server/src/middleware/auth.ts`
- Risk: A silent regression could expose CMS data across roles.
- Priority: High

**Automation date logic not tested:**
- What's not tested: `isSameMonthDay`, `addDays`, the birthday/anniversary stage selection, re-engagement `daysSince >= 30` threshold, and `alreadySent` deduplication window.
- Files: `server/src/routes/automation.ts`
- Risk: Off-by-one errors on date comparisons could result in missed or duplicate sends.
- Priority: High

**Customer upsert phone-collision edge case not tested:**
- What's not tested: The `P2002` unique constraint handler in `POST /api/customers` that re-links a phone number to a new deviceId.
- Files: `server/src/routes/customers.ts`
- Risk: Silent data corruption (wrong customer linked to a device) if the handler misfires.
- Priority: Medium

---

*Concerns audit: 2026-04-24*
