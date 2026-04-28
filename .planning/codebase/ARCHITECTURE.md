# Architecture

**Analysis Date:** 2026-04-28

## Pattern Overview

**Overall:** Multi-tenant monorepo with three independent deployable units — a customer-facing Next.js app, a CMS Next.js app, and an Express/Prisma REST API.

**Key Characteristics:**
- Stateless REST API — no GraphQL, no WebSockets
- All persistence goes through Prisma; no raw SQL queries
- Auth is split: customer app uses device fingerprint (no login), CMS uses Supabase JWT + Prisma Staff table
- Role-based data scoping enforced at the route level on every CMS endpoint
- Menu system is DB-driven (MenuCategory → MenuItem); per-outlet `hasMenu` flag in `client/main/src/lib/outletConfig.ts` controls UI fallback

## Layers

**Customer App (`client/main/`):**
- Purpose: Public-facing mobile-first pages scanned via QR code
- Location: `client/main/src/`
- Contains: Next.js App Router pages, feature components, custom hooks, Axios API client
- Depends on: Express API at `NEXT_PUBLIC_API_URL`
- Used by: End customers via QR scan

**CMS App (`client/cms/`):**
- Purpose: Admin dashboard for admin/owner/franchise_owner roles
- Location: `client/cms/src/`
- Contains: Next.js App Router pages under `(cms)` route group, AuthContext, Axios API client with JWT + auto-refresh interceptor
- Depends on: Express API at `NEXT_PUBLIC_API_URL`
- Used by: StoneOven staff only

**Express API (`server/src/`):**
- Purpose: Single REST backend serving both clients
- Location: `server/src/`
- Contains: Express routers split into public (`/api/*`) and CMS-protected (`/api/cms/*`), Prisma services, lib utilities
- Depends on: PostgreSQL (via Prisma), Supabase Auth (JWT validation), Cloudinary (menu item images)
- Used by: Both Next.js clients

## Data Flow

**QR Scan → Visit Recording:**
1. Customer scans QR code → browser navigates to `client/main` at `/{code}` (outlet slug or code)
2. `useDeviceFingerprint` hook runs `client/main/src/lib/fingerprint.ts` to generate/retrieve a stable browser fingerprint
3. `useOutlet(code)` fetches `GET /api/outlets/{code}` to resolve outlet details
4. `useCustomer(deviceId)` fetches `GET /api/customers/by-device/{deviceId}` to check if customer is known
5. Page calls `POST /api/visits` with `{ deviceId, outletId, visitType: 'qr_scan' }` — server deduplicates within 1-hour window via a `findFirst` check
6. `CustomerVisit` row created; if `customerId` present, `Customer.totalVisits` and `lastVisitDate` incremented

**Customer Feedback (First Visit):**
1. Customer navigates to `/{code}/feedback` → `client/main/src/app/[code]/feedback/page.tsx`
2. Form component at `client/main/src/components/form1/feedback.tsx` collects demographics + star rating
3. Submits to `POST /api/customers` (upsert by phone) and `POST /api/reviews`
4. On success, `Customer.hasSubmittedFirstReview` becomes true; outlet landing page hides the feedback CTA and surfaces the repeat review CTA

**Menu Display:**
1. `client/main/src/app/[code]/menu/page.tsx` reads `outletConfig[code].hasMenu` from `client/main/src/lib/outletConfig.ts`
2. If `false` → renders `<MenuComingSoon>` with no API call (Palghar, Virar, Vasai outlets currently)
3. If `true` (Boisar) → calls `GET /api/menu/outlet/{code}` which resolves by slug OR code, returns active `MenuCategory[]` with nested active `MenuItem[]` ordered by `displayOrder`
4. Client filters locally by search text and veg-only toggle via `client/main/src/components/menu/MenuSearch.tsx`

**CMS Auth Flow:**
1. Staff visits `/login`, submits credentials
2. CMS calls `POST /api/auth/login` → server verifies via Supabase `signInWithPassword`, loads `Staff` record from Prisma, returns `{ token, refreshToken, role, assignedOutletId, ... }`
3. Tokens stored in `localStorage` (`cms_token`, `cms_user`)
4. `client/cms/src/context/AuthContext.tsx` reads tokens on mount, exposes `isAdmin / isOwner / isFranchise` flags
5. CMS layout (`client/cms/src/app/(cms)/layout.tsx`) wraps all protected pages in `AuthProvider` + `CmsShell`; unauthenticated users are redirected to `/login`
6. Every CMS API call attaches `Authorization: Bearer {token}`; 401 triggers token refresh via `POST /api/auth/refresh`, then retries once; second 401 clears session and redirects

**CMS Data Scoping:**
- `admin` and `owner` roles see all active outlets
- `franchise_owner` role sees only `assignedOutletId` — enforced in every CMS route handler that reads `req.staff.role`
- Menu CRUD (`/api/cms/menu/*`) is `requireAdmin` only — only UniCord can manage menu content

**Automation Flow:**
- Cloudflare Worker cron hits `POST /api/automation` with `X-Automation-Secret` header (worker secret guard in `server/src/routes/automation.ts`)
- CMS manual triggers send the same requests with Bearer JWT (dual-auth: worker secret OR staff JWT)
- Server sends WhatsApp/email via `server/src/lib/notifications.ts`, logs results to `AutomationLog`

## Key Abstractions

**`BaseService`:**
- Purpose: Shared Prisma client access + pagination helper
- Location: `server/src/services/BaseService.ts`
- Pattern: Class inheritance — `QRService` and `SentimentService` extend this

**`requireAuth` middleware:**
- Purpose: Validates Supabase JWT, loads `Staff` record, attaches `req.staff` payload with normalized role
- Location: `server/src/middleware/auth.ts`
- Pattern: Applied via `router.use(requireAuth)` at the top of every CMS router; role guards (`requireAdmin`, `requireOwnerOrAbove`) applied per-route

**`outletConfig` (client-side):**
- Purpose: Static per-outlet feature flags — currently only `hasMenu`
- Location: `client/main/src/lib/outletConfig.ts`
- Pattern: Plain TS record keyed by outlet slug. Must be updated when new outlets are added or menu goes live for an outlet

**`AuthContext`:**
- Purpose: CMS-wide session state and role flags
- Location: `client/cms/src/context/AuthContext.tsx`
- Pattern: React context wrapping the `(cms)` route group layout; exposes `isAdmin`, `isOwner`, `isFranchise`, `isOwnerOrAbove` booleans consumed by page-level components to show/hide features

**API clients:**
- CMS: `client/cms/src/lib/api.ts` — Axios with JWT interceptor + token refresh queue + redirect on failure
- Main: `client/main/src/lib/api.ts` — Axios with optional mock mode (`NEXT_PUBLIC_MOCK_API=true`) for local development

## Entry Points

**Customer Outlet Landing:**
- Location: `client/main/src/app/[code]/page.tsx`
- Triggers: QR scan navigation to `/{outlet-slug}`
- Responsibilities: Fingerprint collection, visit recording, outlet landing with links to menu / feedback / review

**Customer Menu:**
- Location: `client/main/src/app/[code]/menu/page.tsx`
- Triggers: "View Menu" button on outlet page
- Responsibilities: Reads `outletConfig[code].hasMenu`; if true fetches `GET /api/menu/outlet/{code}`, renders DB-driven menu with search + veg filter; otherwise renders `<MenuComingSoon>`

**Customer Feedback (First Visit):**
- Location: `client/main/src/app/[code]/feedback/page.tsx`
- Triggers: "Your First Visit" button on outlet page
- Responsibilities: Collects demographics, phone, star rating; POSTs to `/api/customers` + `/api/reviews`

**Customer Repeat Review:**
- Location: `client/main/src/app/[code]/review/page.tsx`
- Triggers: "Share Your Experience" button (only shown when `customer.hasSubmittedFirstReview` is true)
- Responsibilities: Collects star rating and review text; POSTs to `/api/reviews`

**CMS Shell:**
- Location: `client/cms/src/app/(cms)/layout.tsx`
- Triggers: Any CMS route navigation
- Responsibilities: Provides `AuthContext`, enforces auth guard, renders `CMSSidebar` + `<main>`

**Express Server:**
- Location: `server/src/index.ts` → `server/src/app.ts`
- Responsibilities: Mounts all routers, configures CORS from `CORS_ORIGINS` env var, registers global error handler

## Error Handling

**Strategy:** Centralized — route handlers call `next(err)` and the global `errorHandler` middleware formats the response.

**Patterns:**
- All route handlers wrap logic in `try/catch` and forward to `next(err)`
- Global handler: `server/src/middleware/errorHandler.ts`
- Client API errors: Axios interceptors handle 401 (refresh/redirect); other errors bubble to component catch blocks or `console.error`
- Cloudinary delete failures in menu item deletion are swallowed non-fatally (empty catch block — intentional)

## Cross-Cutting Concerns

**Logging:** `console.error` only — no structured logger. CORS errors logged with origin details in `server/src/app.ts`.

**Validation:** Zod schemas in some public routes (e.g., `CreateVisitSchema` in `server/src/routes/visits.ts`); CMS routes use manual `if (!field)` guards. No unified validation layer across all routes.

**Authentication:** Supabase JWT for CMS staff; device fingerprint (no login) for customers.

**Multi-tenancy:** Outlet isolation enforced via `outletId` filters on Prisma queries; `franchise_owner` scoping enforced in route handlers via `req.staff.assignedOutletId`. Menu categories are per-outlet (`MenuCategory.outletId`).

---

*Architecture analysis: 2026-04-28*
