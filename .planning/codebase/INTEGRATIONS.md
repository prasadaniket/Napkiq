# External Integrations

**Analysis Date:** 2026-07-07

## APIs & External Services

**Authentication — Supabase Auth:**
- SDK: `@supabase/supabase-js` ^2.104.0 (server + both clients); `@supabase/ssr` in the Next.js apps
- Server client: `supabaseAdmin` (service role) in `server/src/lib/supabase.ts`
- Flow: CMS login POSTs username → server resolves email → `supabaseAdmin.auth.signInWithPassword` → session token stored in `localStorage` (CMS)
- Verification: `resolveStaffFromToken` calls `supabaseAdmin.auth.getUser(token)` then loads the active `Staff` record — used by both `requireAuth` and the KDS SSE endpoint

**Image Storage — Cloudinary:**
- SDK: `cloudinary` ^2.9.0; config in `server/src/lib/cloudinary.ts`
- Menu item images uploaded via `POST /api/cms/menu/items/:id/image` — multer (memory, 5 MB) → `upload_stream`
- Env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

**WhatsApp Messaging — WaSenderAPI:**
- SDK: `wasenderapi` ^0.4.0 — the current send path (`server/src/lib/notifications.ts`), active when `WASENDER_API_KEY` is set
- Sends plain-text WhatsApp built from admin-editable templates (`templateStore`)
- Dry-run when `AUTOMATION_DRY_RUN=true` or neither `WASENDER_API_KEY` nor `TWILIO_ACCOUNT_SID` is set
- Twilio remains only as commented-out future code (intended Meta-template path); it is **not** an installed dependency

**Transactional Email — Resend:**
- SDK: `resend` ^6.12.2; `server/src/lib/notifications.ts`
- Dry-run until `RESEND_API_KEY` is set; templates in `notifications.ts` (`build*Email`, `buildGenericEmail`)
- Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (default `Napkiq <noreply@napkiq.in>`)

**Browser Fingerprinting — FingerprintJS (open source):**
- SDK: `@fingerprintjs/fingerprintjs` ^5; `client/main/src/lib/fingerprint.ts`
- Storage: `so_device_id` in `localStorage`
- Purpose: identify returning customers, link visits and orders (`Order.deviceId`) before/without registration

## Data Storage

**Database — PostgreSQL:**
- Connection: `DATABASE_URL`; Prisma 7.x via `@prisma/adapter-pg` + `pg.Pool` (`server/src/lib/prisma.ts`)
- Schema: `server/prisma/schema.prisma`; migrations via `prisma migrate deploy`
- Models: `Outlet`, `Customer`, `Review`, `CustomerVisit`, `MenuCategory`, `MenuItem`, `AutomationLog`, `Staff`, `Order`, `OrderCounter`, `OrderItem`
- `order_counters` is an atomic per-outlet/per-day sequence source for daily token numbers (`INSERT … ON CONFLICT`)

**File Storage:** Cloudinary (menu images only); no local user-upload storage.

**Caching / Message bus:** None external. Order events use an **in-process** `EventEmitter` (`server/src/lib/orderEvents.ts`) — not shared across instances.

## Authentication & Identity

**Staff:** Supabase Auth; roles `admin`, `owner`, `franchise_owner` (deprecated `main_owner` mapped → `admin`). Guards in `server/src/middleware/auth.ts`.

**Customer:** Anonymous — identified by FingerprintJS `deviceId`; phone number is the unique registration identifier.

## Real-time (SSE)

- `GET /api/cms/orders/stream?token=&outletId=` — KDS live feed (auth via query-param token)
- `GET /api/orders/:id/stream` — customer per-order status feed (public, keyed by opaque order UUID)
- Both send `text/event-stream` with a 25s heartbeat and set `X-Accel-Buffering: no` to disable proxy buffering on Render

## Monitoring & Observability

- **Error tracking:** none (no Sentry/Datadog)
- **Logs:** `console.log` / `console.error`
- **Health check:** `GET /api/health` → `{ status: "ok", timestamp }`

## CI/CD & Deployment

- **Server:** Render (`so-ta1t.onrender.com`, fronted by `api.napkiq.in`); Docker image via `docker-compose.yml`
- **Main client:** Netlify (`netlify.toml`) → `napkiq.in`
- **CMS client:** Vercel (per codebase comments)
- **Worker:** Cloudflare Workers (`napkiq-automation`) — `wrangler deploy`
- **CI pipeline:** none detected

**Cron Automation:**
- Worker `worker/src/index.ts` fires daily at 03:00 UTC (08:30 IST) → `POST /api/automation/run` with `x-automation-secret`
- CMS manual trigger uses the same endpoint with a Bearer JWT (dual-auth)
- Config: `worker/wrangler.toml`; `SERVER_URL = https://so-ta1t.onrender.com`; account ID `11de51483dbed991a23c44341f0ca00d`

## Environment Configuration

**Required server env vars:**
- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `CORS_ORIGINS` (comma-separated; empty = allow all, dev only)
- `AUTOMATION_SECRET`, `PORT` (default 8080)

**Optional server env vars (notifications):**
- `AUTOMATION_DRY_RUN`, `WASENDER_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

**Client env vars:**
- `NEXT_PUBLIC_API_URL` (default `https://api.napkiq.in/api`)
- `NEXT_PUBLIC_APP_URL` (QR target base, default `https://napkiq.in`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MOCK_API=true` (CMS only)

## Webhooks & Callbacks

- **Incoming:** none
- **Outgoing:** Cloudflare Worker → `POST /api/automation/run`; per-outlet Google Maps links (`googleMapsUrl`) and Google Place IDs (`googlePlaceId`) are stored for client-side redirects — no server-side Google API calls

---

*Integration audit: 2026-07-07*
