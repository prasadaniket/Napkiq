# External Integrations

**Analysis Date:** 2026-04-28

## APIs & External Services

**Authentication:**
- Supabase Auth — Staff login and token verification
  - SDK: `@supabase/supabase-js` ^2.104.0 (server + both clients)
  - Server client: `supabaseAdmin` (service role) in `server/src/lib/supabase.ts`
  - Client SSR helpers: `@supabase/ssr` ^0.10.2 in both Next.js apps
  - Flow: CMS login POSTs username → server resolves email → `supabaseAdmin.auth.signInWithPassword` → returns session token → stored in `localStorage` (CMS) or cookie (main client)
  - Token verification: every CMS route calls `supabaseAdmin.auth.getUser(token)` in `server/src/middleware/auth.ts`

**Image Storage:**
- Cloudinary — Menu item image hosting
  - SDK: `cloudinary` ^2.9.0
  - Config: `server/src/lib/cloudinary.ts`; cloud name defaults to `dfc95tllh`
  - Upload folder: `StoneOven/menu`
  - Upload route: `POST /api/cms/menu/items/:id/image` — multer (memory, 5 MB) → `cloudinary.uploader.upload_stream`
  - Env vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

**WhatsApp Messaging:**
- Twilio — Birthday/anniversary/re-engagement WhatsApp messages via Meta templates
  - SDK: `twilio` ^6.0.0
  - Implementation: `server/src/lib/notifications.ts` — currently in **dry-run mode** (logs payload, returns `success=true`)
  - Dry-run condition: `AUTOMATION_DRY_RUN=true` OR `TWILIO_ACCOUNT_SID` not set
  - Env vars (when live): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
  - Activation: uncomment Twilio block in `server/src/lib/notifications.ts`

**Transactional Email:**
- Resend — Birthday/anniversary/re-engagement emails
  - SDK: `resend` ^6.12.2
  - Implementation: `server/src/lib/notifications.ts` — currently in **dry-run mode**
  - Dry-run condition: `RESEND_API_KEY` not set
  - Env vars (when live): `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - Activation: uncomment Resend block in `server/src/lib/notifications.ts`

**Browser Fingerprinting:**
- FingerprintJS (open source) — Anonymous customer visit tracking
  - SDK: `@fingerprintjs/fingerprintjs` ^5
  - Implementation: `client/main/src/lib/fingerprint.ts`
  - Storage: `so_device_id` in `localStorage` (SSR-safe fallback)
  - Purpose: identify returning customers before they submit a form; passed as `deviceId` to visit and customer APIs

## Data Storage

**Database:**
- PostgreSQL (hosted on Supabase or external Render DB)
  - Connection: `DATABASE_URL` env var
  - Client: Prisma 7.x via `@prisma/adapter-pg` + `pg.Pool`; `server/src/lib/prisma.ts`
  - Schema: `server/generated/prisma/schema.prisma`
  - Migrations: `prisma migrate deploy` (via `npm run prisma:migrate`)
  - Models: `Outlet`, `Customer`, `Review`, `CustomerVisit`, `MenuCategory`, `MenuItem`, `AutomationLog`, `Staff`, `OtpVerification`

**File Storage:**
- Cloudinary (see above) — menu item images only
- No local filesystem storage for user-uploaded files

**Caching:**
- None detected

## Authentication & Identity

**Staff Auth Provider:** Supabase Auth
- Server validates Bearer tokens via `supabaseAdmin.auth.getUser(token)`
- Username → email resolution done via Prisma lookup before Supabase sign-in
- Roles enforced server-side: `admin`, `owner`, `franchise_owner` (mapped from Prisma `StaffRole` enum)
- Role guards in `server/src/middleware/auth.ts`: `requireAuth`, `requireAdmin`, `requireOwnerOrAbove`

**Customer Identity:** Anonymous (device fingerprint)
- No login; customers identified by `deviceId` from FingerprintJS
- Phone number collected on first visit form and stored as unique identifier

## Monitoring & Observability

**Error Tracking:** Not detected (no Sentry, Datadog, etc.)

**Logs:** `console.log` / `console.error` throughout; CORS errors explicitly logged to server console

**Health Check:** `GET /api/health` returns `{ status: "ok", timestamp }` — used by Docker healthcheck

## CI/CD & Deployment

**Hosting:**
- Server: Render (primary production URL `api.stoneoven.in`); Docker image also available via `docker-compose.yml`
- Main client: Netlify (`netlify.toml`, `@netlify/plugin-nextjs` plugin) → `stoneoven.in`
- CMS client: Vercel (referenced in codebase; not in `netlify.toml`)
- Worker: Cloudflare Workers — deploy via `wrangler deploy` from `worker/`

**CI Pipeline:** Not detected (no GitHub Actions, CircleCI, etc.)

**Cron Automation:**
- Cloudflare Worker (`worker/src/index.ts`) fires daily at 03:00 UTC (08:30 IST)
- Calls `POST /api/automation/run` on Express server with `x-automation-secret` header
- Server also accepts manual trigger from CMS (dual-auth: worker secret OR staff JWT)
- Worker config: `worker/wrangler.toml`; Cloudflare account ID `11de51483dbed991a23c44341f0ca00d`

## Environment Configuration

**Required server env vars:**
- `DATABASE_URL` — PostgreSQL connection string
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (throws on startup if missing)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — Image uploads
- `CORS_ORIGINS` — Comma-separated allowed origins (empty = allow all, for dev)
- `AUTOMATION_SECRET` — Shared secret between Cloudflare Worker and Express
- `PORT` — HTTP listen port (default: 8080)

**Optional server env vars (notifications):**
- `AUTOMATION_DRY_RUN` — Set `true` to force dry-run regardless of other keys
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`

**Required client env vars:**
- `NEXT_PUBLIC_API_URL` — Backend base URL (default fallback: `https://so-4ntt.onrender.com/api`)
- `NEXT_PUBLIC_APP_URL` — Used by QRService to build QR scan URLs (default: `https://stoneoven.in`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Optional client env vars:**
- `NEXT_PUBLIC_MOCK_API=true` — CMS only; activates mock API layer from `client/cms/src/lib/mock-api.ts`

## Webhooks & Callbacks

**Incoming:** None detected

**Outgoing:**
- Cloudflare Worker → `POST /api/automation/run` on Express (daily cron)
- Google Maps links embedded per outlet (`googleMapsUrl` field in `Outlet` model); no server-side Maps API calls detected
- Google Place ID stored per outlet (`googlePlaceId`) for Google review redirects; no server-side Places API calls

---

*Integration audit: 2026-04-28*
