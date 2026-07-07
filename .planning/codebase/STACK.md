# Technology Stack

**Analysis Date:** 2026-07-07

## Languages

- TypeScript across all three packages (server, client/cms, client/main) and the worker
- Server compiler: TypeScript ^6.0.3 (devDependency)

## Runtime

- Node.js >=20.0.0, npm >=10.0.0 (enforced via `engines` in `server/package.json`)

## Frameworks

**Backend:**
- Express ^5.2.1 (`server/`) — HTTP REST API, port 8080
- Prisma ^7.7.0 + `@prisma/adapter-pg` — ORM over a raw `pg.Pool` adapter; client generated to `server/generated/prisma/`

**Frontend (both clients):**
- Next.js (App Router) + React 19
- CMS on port 3001, customer app on port 3000

**Cron Worker:**
- Cloudflare Workers (`worker/`, `napkiq-automation`) — daily automation at 03:00 UTC / 08:30 IST
- Wrangler toolchain

**Testing:** None installed in any package manifest.

**Build/Dev:**
- `ts-node-dev` — hot-reload dev server for Express
- `tsc` — server production compile to `server/dist/`

## Key Dependencies

**Backend — Core:**
- `@prisma/client` / `@prisma/adapter-pg` ^7.7.0, `pg` ^8.20.0 — DB access
- `express` ^5.2.1, `cors` ^2.8.6
- `express-rate-limit` ^7.5.1 — global + targeted rate limiting (`server/src/middleware/rateLimit.ts`)
- `zod` ^4.3.6 — request validation
- `dotenv` ^17.4.2

**Backend — Auth:**
- `@supabase/supabase-js` ^2.104.0 — `supabaseAdmin` verifies Bearer tokens and signs staff in
- `jsonwebtoken` ^9.0.3 — token refresh endpoint

**Backend — Notifications:**
- `wasenderapi` ^0.4.0 — **current** WhatsApp send path (active when `WASENDER_API_KEY` is set); Twilio is referenced only in commented-out code and is no longer a dependency
- `resend` ^6.12.2 — transactional email (dry-run until `RESEND_API_KEY` is set)

**Backend — Media & QR:**
- `cloudinary` ^2.9.0 — menu item image uploads
- `multer` ^2.1.1 — multipart upload (memory storage, 5 MB limit)
- `qrcode` ^1.5.4 — outlet QR generation (`QRService`)

**Backend — Analytics & Export:**
- `sentiment` ^5.0.2 — local keyword-based review sentiment scoring
- `csv-stringify` ^6.7.0 — CSV export
- `exceljs` ^4.4.0 — Excel (.xlsx) export (`server/src/routes/cms/export.ts`)

**CMS Client:**
- `axios`, `react-hook-form` + `@hookform/resolvers` + `zod`, `@supabase/supabase-js` + `@supabase/ssr`, `react-hot-toast`, `lucide-react`, `date-fns`, `class-variance-authority` + `clsx` + `tailwind-merge`, `@radix-ui/react-avatar`

**Main Client:**
- `axios`, `@fingerprintjs/fingerprintjs` (device id `so_device_id`), `framer-motion`, `recharts`, `react-hook-form` + `zod`, `@supabase/supabase-js` + `@supabase/ssr`, `react-hot-toast`, `date-fns`

**Shared Styling:**
- Tailwind CSS (both clients) + PostCSS + Autoprefixer. The CMS layers a CSS-variable design system on top (see CONVENTIONS.md).

## Configuration

**Environment files (existence only — never read contents):**
- `server/.env` — database, Supabase, Cloudinary, WaSenderAPI, Resend, CORS, automation secrets
- `client/cms/.env.local` — `NEXT_PUBLIC_API_URL`, Supabase public keys, `NEXT_PUBLIC_MOCK_API`
- `client/main/.env.local` — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, Supabase public keys
- Worker secrets via `wrangler secret put AUTOMATION_SECRET` / `WASENDER_API_KEY`; `SERVER_URL` in `worker/wrangler.toml`

**Build configs:**
- Server: `server/tsconfig.json`
- Clients: Next.js config per app
- Worker: `worker/wrangler.toml`
- Netlify: `netlify.toml` (base: `client/main`, `@netlify/plugin-nextjs`)

**Mock API toggle:**
- CMS: `NEXT_PUBLIC_MOCK_API=true` swaps the real Axios instance for `client/cms/src/lib/mock-api.ts`

## Platform Requirements

**Development:** Node >=20, npm >=10, PostgreSQL, a Supabase project. Ports: 8080 (server), 3000 (main), 3001 (CMS).

**Production:**
- Server: Render (`so-ta1t.onrender.com`, fronted by `api.napkiq.in`); Docker image also available
- Main client: Netlify → `napkiq.in`
- CMS client: Vercel (per codebase comments)
- Worker: Cloudflare Workers (`napkiq-automation`), daily cron

---

*Stack analysis: 2026-07-07*
