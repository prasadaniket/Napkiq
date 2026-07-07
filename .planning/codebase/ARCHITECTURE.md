# Architecture

**Analysis Date:** 2026-07-07

## Pattern Overview

**Overall:** Multi-tenant monorepo with three independent deployable units plus a cron worker — a customer-facing Next.js app, a CMS Next.js app, an Express/Prisma REST API, and a Cloudflare Worker for daily automation.

**Key Characteristics:**
- Mostly stateless REST API. The one real-time surface is order events, delivered over **Server-Sent Events (SSE)** — no WebSockets, no GraphQL.
- All persistence goes through Prisma. The only raw SQL is the atomic daily-token upsert in `server/src/lib/orders.ts`.
- Auth is split: customer app uses device fingerprint (no login), CMS uses Supabase JWT + Prisma `Staff` table.
- Role-based data scoping enforced at the route level on every CMS endpoint.
- Rate limiting is applied globally (`generalLimiter`) plus targeted limiters on auth, public writes, and automation.
- Menu system is DB-driven (`MenuCategory` → `MenuItem`); per-outlet `hasMenu` flag in `client/main/src/lib/outletConfig.ts` controls the customer UI fallback (all outlets currently `true`).

## Layers

**Customer App (`client/main/`):**
- Public-facing mobile-first pages scanned via QR code — landing, menu + cart, order tracking, feedback/review forms
- Depends on the Express API at `NEXT_PUBLIC_API_URL`

**CMS App (`client/cms/`):**
- Admin dashboard for admin/owner/franchise_owner roles — analytics, customers, reviews, visits, KDS, celebrations, automation, media
- Depends on the Express API at `NEXT_PUBLIC_API_URL`; light-theme design system

**Express API (`server/src/`):**
- Single REST backend serving both clients, split into public (`/api/*`) and CMS-protected (`/api/cms/*`) routers
- Depends on PostgreSQL (Prisma), Supabase Auth (JWT validation), Cloudinary (menu images), WaSenderAPI (WhatsApp), Resend (email)

**Automation Worker (`worker/`):**
- Cloudflare Worker `napkiq-automation`, daily cron at 03:00 UTC (08:30 IST) → `POST /api/automation/run`

## Data Flow

**QR Scan → Visit Recording:**
1. Customer scans QR → navigates to `client/main` at `/{code}` (outlet slug or code)
2. `useDeviceFingerprint` generates/retrieves a stable browser fingerprint (`so_device_id` in `localStorage`)
3. `useOutlet(code)` fetches `GET /api/outlets/{code}`; `useCustomer(deviceId)` checks for a known customer
4. Page calls `POST /api/visits` — server deduplicates within a 1-hour window
5. `CustomerVisit` row created; if `customerId` present, `Customer.totalVisits` / `lastVisitDate` updated

**Customer Ordering (menu → cart → order → tracking):**
1. Customer opens `/{code}/menu`, which fetches the DB-driven menu and builds a local cart
2. Cart submits `POST /api/orders` with `{ outletCode|outletId, deviceId, serviceType, boardNumber?, items[] }`
3. Server (`createOrderWithItems` in `server/src/lib/orders.ts`) **snapshots name/price server-side** from the DB (client prices are never trusted), validates each item belongs to the outlet, resolves variant prices, and atomically allocates a per-outlet **daily token number** (resets at IST midnight) via an `INSERT … ON CONFLICT` on `order_counters`
4. The new order is broadcast to the KDS through `emitOrderEvent` (`server/src/lib/orderEvents.ts`)
5. Customer is redirected to `/{code}/order/{id}`, which opens an SSE stream at `GET /api/orders/{id}/stream` for live status; `/{code}/orders` lists this device's history via `GET /api/orders/by-device/{deviceId}`
6. Customer may self-cancel via `PATCH /api/orders/{id}/cancel` — only while `status = new` and only from the placing device

**Kitchen Display (KDS):**
1. CMS `kds` page (`KitchenBoard.tsx`) opens an `EventSource` to `GET /api/cms/orders/stream?token={jwt}&outletId={id}`
2. The endpoint authenticates the token (same Supabase + Staff lookup as `requireAuth`), scopes to one outlet (franchise_owner pinned to their outlet), and subscribes to that outlet's channel in `orderEvents`
3. Every order create and status change emits a `created`/`status` event, fanned out in-process to all connected tablets
4. Staff advance orders through `new → preparing → ready → served` (or `cancelled`) via CMS status-update endpoints, which re-emit events

**Menu Display:**
1. `client/main/src/app/[code]/menu/page.tsx` reads `outletConfig[code].hasMenu`
2. If `true` → `GET /api/menu/outlet/{code}` returns active `MenuCategory[]` with nested active `MenuItem[]`; client filters by search text and veg-only toggle, and supports variant-priced items

**CMS Auth Flow:**
1. Staff submit credentials at `/login` → `POST /api/auth/login` (rate-limited by `authLimiter`)
2. Server verifies via Supabase `signInWithPassword`, loads `Staff`, returns `{ token, refreshToken, role, assignedOutletId, ... }`
3. Tokens stored in `localStorage`; `AuthContext` exposes `isAdmin / isOwner / isFranchise` flags
4. Every CMS API call attaches `Authorization: Bearer {token}`; 401 triggers a refresh + single retry, then clears the session

**CMS Data Scoping:**
- `admin` and `owner` see all active outlets; `franchise_owner` sees only `assignedOutletId`, enforced in every handler
- Menu CRUD and data export are `requireAdmin` only

**Automation Flow:**
- Cloudflare Worker cron → `POST /api/automation/run` with `X-Automation-Secret`; CMS manual triggers send the same request with a Bearer JWT (dual-auth). Rate-limited by `automationLimiter`.
- Server sends WhatsApp (WaSenderAPI, when `WASENDER_API_KEY` set) / email (Resend), logs results to `AutomationLog`. Falls back to dry-run logging when providers are unconfigured.

## Key Abstractions

**`createOrderWithItems` + `orderEvents`:**
- `server/src/lib/orders.ts` is the single order-creation path shared by the public customer route and the staff CMS route — server-side price snapshotting and daily token allocation live here
- `server/src/lib/orderEvents.ts` is an in-process `EventEmitter` bus keyed per outlet (`order:{outletId}`). **In-process only** — correct for the single-instance Render deploy; would need Postgres LISTEN/NOTIFY or Redis if scaled horizontally

**`resolveStaffFromToken` + role guards:**
- `server/src/middleware/auth.ts` — validates a Supabase token and resolves an active `Staff` payload with a normalized role. Shared by `requireAuth` (Bearer header) and the KDS SSE endpoint (`?token=` query param). Role guards: `requireAdmin`, `requireOwnerOrAbove`.

**Rate limiters:**
- `server/src/middleware/rateLimit.ts` — a `make(windowMs, max, message)` factory produces `generalLimiter` (global), `authLimiter`, `writeLimiter`, `automationLimiter`. `app.set('trust proxy', 1)` ensures keys use the real client IP behind Render.

**`outletConfig` (client-side):**
- `client/main/src/lib/outletConfig.ts` — static per-outlet feature flags (`hasMenu`)

**API clients:**
- CMS: `client/cms/src/lib/api.ts` — Axios with JWT interceptor + refresh queue
- Main: `client/main/src/lib/api.ts` — Axios with optional mock mode

## Entry Points

- **Customer landing:** `client/main/src/app/[code]/page.tsx` — QR target; fingerprint + visit recording
- **Customer menu/cart:** `client/main/src/app/[code]/menu/page.tsx`
- **Order tracking:** `client/main/src/app/[code]/order/[id]/page.tsx` — SSE status feed
- **KDS:** `client/cms/src/app/(cms)/kds/page.tsx` + `components/orders/KitchenBoard.tsx`
- **CMS shell:** `client/cms/src/app/(cms)/layout.tsx`
- **Express server:** `server/src/index.ts` → `server/src/app.ts`

## Error Handling

**Strategy:** Centralized — route handlers call `next(err)` and the global `errorHandler` formats the response.
- `OrderValidationError` (`server/src/lib/orders.ts`) carries an HTTP status; order routes translate it to a 4xx directly
- Zod parse at handler entry; `ZodError` → 400 via the error handler
- SSE handlers clean up (`clearInterval`, `unsubscribe`, `res.end()`) on `req.on('close')`

## Cross-Cutting Concerns

**Logging:** `console.log` / `console.error` only — no structured logger.

**Validation:** Zod schemas on public routes (visits, orders, etc.); CMS routes mix Zod and manual guards.

**Real-time:** SSE for order events (KDS + customer tracking), brokered in-process per outlet.

**Multi-tenancy:** Outlet isolation via `outletId` filters; `franchise_owner` scoping via `assignedOutletId`. Orders, menu categories, and daily token counters are all per-outlet.

---

*Architecture analysis: 2026-07-07*
