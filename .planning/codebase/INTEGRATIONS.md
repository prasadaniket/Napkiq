# External Integrations

**Analysis Date:** 2026-04-24

## Summary

StoneOven integrates five external services: Supabase (PostgreSQL database + Auth), Cloudinary (menu image storage), Twilio (WhatsApp messaging), Resend (transactional email), and Cloudflare Workers (cron scheduler). Twilio and Resend are installed and wired but currently operate in DRY_RUN mode — all sends are logged to console without hitting the real APIs until credentials are activated.

---

## Supabase

**Role:** PostgreSQL database hosting + Staff authentication

### Database
- **Provider:** Supabase (managed PostgreSQL)
- **Region:** `aws-1-ap-northeast-1` (Tokyo)
- **Connection:** pgBouncer connection pooler via `DATABASE_URL`
- **Client:** `pg.Pool` → `@prisma/adapter-pg` → `PrismaClient`
- **Implementation:** `server/src/lib/prisma.ts`
- **Env var:** `DATABASE_URL` (server `.env`)

### Auth
- **Role:** Issues JWTs for CMS staff login
- **Server SDK:** `@supabase/supabase-js ^2.104.0` — service-role admin client
- **Client SDK:** `@supabase/ssr ^0.10.2` — browser + server SSR client
- **Token verification:** `supabaseAdmin.auth.getUser(token)` in `server/src/middleware/auth.ts`
- **Admin client:** `server/src/lib/supabase.ts` (uses service role key — never expose client-side)
- **Browser clients:** `client/cms/src/utils/supabase/client.ts`, `client/main/src/utils/supabase/client.ts`
- **Server SSR clients:** `client/cms/src/utils/supabase/server.ts`, `client/main/src/utils/supabase/server.ts`

**Env vars:**
| Var | Where used |
|-----|-----------|
| `SUPABASE_URL` | server — admin client |
| `SUPABASE_SERVICE_ROLE_KEY` | server — admin client (secret, never client-side) |
| `NEXT_PUBLIC_SUPABASE_URL` | client/main, client/cms — browser client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client/main, client/cms — browser client |

**Staff record:** `staff.id` mirrors `auth.users.id` in Supabase Auth (UUID). Staff are created via `server/src/scripts/setup_staff.ts`.

---

## Cloudinary

**Role:** Menu item image hosting and upload

- **SDK:** `cloudinary ^2.9.0` (server-side only)
- **Implementation:** `server/src/lib/cloudinary.ts`
- **Cloud name (hardcoded fallback):** `dfc95tllh`
- **Upload folder:** `StoneOven/menu` (constant `MENU_FOLDER`)
- **Upload flow:** CMS admin POSTs image → multer buffers in memory (5 MB limit) → server streams to Cloudinary → stores returned `imageUrl` on `MenuItem.imageUrl`
- **Route:** `server/src/routes/cms/menu.ts` (admin-only, uses `requireAdmin` guard)
- **Image URLs:** Stored as `VARCHAR(500)` on `menu_items.image_url`

**Env vars:**
| Var | Default |
|-----|---------|
| `CLOUDINARY_CLOUD_NAME` | `dfc95tllh` (hardcoded fallback) |
| `CLOUDINARY_API_KEY` | required |
| `CLOUDINARY_API_SECRET` | required |

---

## Twilio (WhatsApp)

**Role:** WhatsApp template message delivery for birthday, anniversary, and re-engagement automations

- **SDK:** `twilio ^6.0.0` (server-side only)
- **Implementation:** `server/src/lib/notifications.ts` — `sendWhatsApp()` function
- **Status: DRY_RUN MODE** — SDK `require` is commented out; actual send is skipped if `TWILIO_ACCOUNT_SID` is absent or `AUTOMATION_DRY_RUN=true`
- **DRY_RUN condition:** `process.env.AUTOMATION_DRY_RUN === 'true' || !process.env.TWILIO_ACCOUNT_SID`
- **Message types:** WhatsApp template messages (Meta-approved templates)
  - `stoneoven_birthday_five_days_before`
  - `stoneoven_birthday_one_day_before`
  - `stoneoven_birthday_on_day`
  - `stoneoven_anniversary_five_days_before`
  - `stoneoven_anniversary_one_day_before`
  - `stoneoven_anniversary_on_day`
  - `stoneoven_reengagement`
- **Phone format:** E.164 (`+91XXXXXXXXXX`), normalised in `server/src/routes/automation.ts`

**Env vars (required to activate):**
| Var | Purpose |
|-----|---------|
| `TWILIO_ACCOUNT_SID` | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio auth secret |
| `TWILIO_WHATSAPP_FROM` | Sender WhatsApp number (e.g. `+14155238886`) |

**To activate:** Uncomment the Twilio block in `server/src/lib/notifications.ts` and set the three env vars above.

---

## Resend (Email)

**Role:** Transactional HTML email delivery for birthday, anniversary, and re-engagement automations

- **SDK:** `resend ^6.12.2` (server-side only)
- **Implementation:** `server/src/lib/notifications.ts` — `sendEmail()` function
- **Status: DRY_RUN MODE** — SDK `require` is commented out; actual send is skipped if `RESEND_API_KEY` is absent or `AUTOMATION_DRY_RUN=true`
- **DRY_RUN condition:** `process.env.AUTOMATION_DRY_RUN === 'true' || !process.env.RESEND_API_KEY`
- **Email templates (inline HTML):** Birthday, Anniversary, Re-engagement — built by helpers in `server/src/lib/notifications.ts`
  - `buildBirthdayEmail(customerName, daysUntil)`
  - `buildAnniversaryEmail(customerName, daysUntil)`
  - `buildReengagementEmail(customerName, daysSince)`
- **From address (default):** `StoneOven <noreply@stoneoven.in>`

**Env vars (required to activate):**
| Var | Purpose |
|-----|---------|
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM_EMAIL` | From address (falls back to `StoneOven <noreply@stoneoven.in>`) |

**To activate:** Uncomment the Resend block in `server/src/lib/notifications.ts` and set `RESEND_API_KEY`.

---

## Cloudflare Workers (Cron Scheduler)

**Role:** Daily automation trigger — calls the Express server on schedule

- **Worker name:** `stoneoven-automation` (deployed as `stoneoven-automation.unicord26.workers.dev`)
- **Account ID:** `11de51483dbed991a23c44341f0ca00d` (in `worker/wrangler.toml`)
- **Cron schedule:** `0 3 * * *` (03:00 UTC = 08:30 IST daily)
- **Implementation:** `worker/src/index.ts`
- **Config:** `worker/wrangler.toml`
- **Production server URL:** `https://api.stoneoven.in` (set via `[vars] SERVER_URL`)
- **Dev server URL:** `http://localhost:8080` (set via `[env.development.vars]`)

**Endpoints the worker calls:**
| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/automation/run` | `x-automation-secret` header | Full daily automation (birthday, anniversary, re-engagement) |
| `POST /api/automation/reengagement` | `x-automation-secret` header | Re-engagement only |

**Worker endpoints (for manual trigger / health):**
| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /` | none | Health check |
| `POST /trigger` | `x-trigger-key` header | Manual full automation trigger |
| `POST /trigger/reengagement` | `x-trigger-key` header | Manual re-engagement trigger |

**Worker secrets (set via `wrangler secret put`):**
| Var | Purpose |
|-----|---------|
| `AUTOMATION_SECRET` | Shared secret between worker and Express server (header: `x-automation-secret`) |
| `TRIGGER_KEY` | Optional key to protect manual HTTP trigger |

**Server-side guard:** `server/src/routes/automation.ts` — `requireWorkerSecret()` checks `x-automation-secret` header against `AUTOMATION_SECRET` env var. In production, missing secret returns 403. CMS admin can also trigger re-engagement via JWT Bearer token.

---

## API Communication (Internal)

**client/main → server:**
- Base URL: `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:8080/api`)
- Client: `client/main/src/lib/api.ts` — axios instance
- Mock mode: `NEXT_PUBLIC_MOCK_API=true` switches to `client/main/src/lib/mock-api.ts`
- No auth header — public API only

**client/cms → server:**
- Base URL: `NEXT_PUBLIC_API_URL` (falls back to `http://localhost:8080/api`)
- Client: `client/cms/src/lib/api.ts` — axios instance with JWT interceptors
- Auth: Bearer token from `cms_token` cookie attached to every request
- 401 handling: auto-refresh via `/api/auth/refresh`, then redirect to `/login`

**CORS:** Server reads allowed origins from `CORS_ORIGINS` env var (comma-separated list). Configured in `server/src/app.ts`.

---

## CSV Export (No External Service)

**Role:** Data export for CMS admin

- Uses `csv-stringify ^6.7.0` (no external service)
- Routes: `GET /api/cms/export/customers`, `GET /api/cms/export/visits`
- Admin-only (`requireAuth` + `requireAdmin`)
- Implementation: `server/src/routes/cms/export.ts`

---

## Environment Variable Reference

### server (`server/.env`)
| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role (secret) |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud (fallback: `dfc95tllh`) |
| `CLOUDINARY_API_KEY` | Yes (for uploads) | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes (for uploads) | Cloudinary API secret |
| `AUTOMATION_SECRET` | Yes (production) | Shared secret with Cloudflare Worker |
| `TWILIO_ACCOUNT_SID` | No (DRY_RUN if absent) | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | No (DRY_RUN if absent) | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | No (DRY_RUN if absent) | Twilio WhatsApp sender number |
| `RESEND_API_KEY` | No (DRY_RUN if absent) | Resend API key |
| `RESEND_FROM_EMAIL` | No | Email from address |
| `AUTOMATION_DRY_RUN` | No | Set `true` to force DRY_RUN regardless of other vars |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `PORT` | No | Server port (default: `8080`) |
| `NODE_ENV` | No | `production` enables strict checks |

### client/main (`client/main/.env.local`)
| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_MOCK_API` | Set `true` to use mock API |

### client/cms (`client/cms/.env.local`)
| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

### worker (Cloudflare secrets via `wrangler secret put`)
| Var | Purpose |
|-----|---------|
| `AUTOMATION_SECRET` | Must match server `AUTOMATION_SECRET` |
| `TRIGGER_KEY` | Optional manual trigger protection |

---

*Integration audit: 2026-04-24*
