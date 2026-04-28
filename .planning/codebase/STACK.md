# Technology Stack

**Analysis Date:** 2026-04-28

## Languages

**Primary:**
- TypeScript 5.x — All three packages (server, client/cms, client/main)
- TypeScript 6.x — Server devDependency (compiler in `server/package.json`)

## Runtime

**Environment:**
- Node.js >=20.0.0 (enforced via `engines` in `server/package.json`)

**Package Manager:**
- npm >=10.0.0 (enforced via `engines` in `server/package.json`)
- Lockfiles: present per workspace root

## Frameworks

**Backend:**
- Express 5.x (`server/`) — HTTP REST API, port 8080
- Prisma 7.x + `@prisma/adapter-pg` — ORM using raw `pg.Pool` adapter (no Prisma connection pooler)
- Prisma client generated to `server/generated/prisma/`

**Frontend — CMS Dashboard:**
- Next.js 16.2.4 (`client/cms/`) — Staff CMS, runs on port 3001
- React 19.x

**Frontend — Customer App:**
- Next.js 16.2.4 (`client/main/`) — Customer-facing QR experience, runs on port 3000
- React 19.x

**Cron Worker:**
- Cloudflare Workers (`worker/`) — Daily automation trigger (03:00 UTC / 08:30 IST)
- Wrangler 3.x — Worker build and deploy toolchain

**Testing:**
- Not detected in any package manifest

**Build/Dev:**
- `ts-node-dev` — Hot-reload dev server for Express (`server/`)
- `tsc` — Server production compile to `server/dist/`

## Key Dependencies

**Backend — Core:**
- `@prisma/client` ^7.7.0 — ORM client
- `@prisma/adapter-pg` ^7.7.0 — Prisma driver adapter for `node-postgres`
- `pg` ^8.20.0 — PostgreSQL client (`Pool`) used by Prisma adapter; `server/src/lib/prisma.ts`
- `express` ^5.2.1 — HTTP server; app created in `server/src/app.ts`
- `zod` ^4.3.6 — Request validation on all routes
- `cors` ^2.8.6 — CORS middleware; origins from `CORS_ORIGINS` env var

**Backend — Auth:**
- `@supabase/supabase-js` ^2.104.0 — `supabaseAdmin` client verifies Bearer tokens and signs in staff; `server/src/lib/supabase.ts`
- `jsonwebtoken` ^9.0.3 — JWT creation for token refresh endpoint

**Backend — Notifications (dry-run until configured):**
- `twilio` ^6.0.0 — WhatsApp messaging via Meta templates; stubs in `server/src/lib/notifications.ts`, activated by setting `TWILIO_ACCOUNT_SID`
- `resend` ^6.12.2 — Transactional email; stubs in `server/src/lib/notifications.ts`, activated by setting `RESEND_API_KEY`

**Backend — Media & QR:**
- `cloudinary` ^2.9.0 — Menu item image uploads; folder `StoneOven/menu`; `server/src/lib/cloudinary.ts`
- `multer` ^2.1.1 — Multipart upload handling, memory storage, 5 MB limit; used in `server/src/routes/cms/menu.ts`
- `qrcode` ^1.5.4 — SVG/PNG/dataURL QR generation for outlet landing pages; `server/src/services/QRService.ts`

**Backend — Analytics & Export:**
- `sentiment` ^5.0.2 — Local keyword-based review sentiment scoring (no external API); `server/src/services/SentimentService.ts`
- `csv-stringify` ^6.7.0 — Customer/visit CSV export; `server/src/routes/cms/export.ts`

**CMS Client — Core:**
- `axios` ^1.7.2 — API client; JWT from `localStorage` (`cms_token`) injected via interceptor; `client/cms/src/lib/api.ts`
- `react-hook-form` ^7.51.5 + `@hookform/resolvers` ^5 — Form state management
- `zod` ^4 — Form validation schemas
- `@supabase/supabase-js` ^2.104.0 + `@supabase/ssr` ^0.10.2 — Auth session
- `react-hot-toast` ^2.4.1 — Toast notifications
- `lucide-react` ^0.468.0 — Icon library
- `date-fns` ^4 — Date formatting/manipulation
- `class-variance-authority` ^0.7.1 + `clsx` ^2.1.1 + `tailwind-merge` ^2.5.2 — className utilities
- `@radix-ui/react-avatar` ^1.1.11 — Accessible avatar component

**Main Client — Core:**
- `axios` ^1.7.2 — API client; JWT from cookie injected via interceptor with refresh queue; `client/main/src/lib/api.ts`
- `@fingerprintjs/fingerprintjs` ^5 — Browser fingerprinting for anonymous visit tracking; stored as `so_device_id` in `localStorage`; `client/main/src/lib/fingerprint.ts`
- `framer-motion` ^12 — Page and component animations throughout outlet flow
- `recharts` ^3 — Charts (used in customer-facing views)
- `react-hook-form` ^7.51.5 + `@hookform/resolvers` ^5 — Feedback/review forms
- `zod` ^4 — Form validation
- `@supabase/supabase-js` ^2.104.0 + `@supabase/ssr` ^0.10.2 — Auth
- `react-hot-toast` ^2.4.1 — Toast notifications
- `date-fns` ^4 — Date formatting
- `@radix-ui/react-avatar` ^1.1.11 — Avatar component

**Shared Styling:**
- Tailwind CSS ^3.4.4 — Utility-first CSS (both clients)
- PostCSS ^8 + Autoprefixer ^10 — CSS processing pipeline

## Configuration

**Environment files (existence only — never read contents):**
- `server/.env` — Holds database, Supabase, Cloudinary, Twilio, Resend, CORS, automation secrets
- `client/cms/.env.local` — `NEXT_PUBLIC_API_URL`, Supabase public keys, `NEXT_PUBLIC_MOCK_API`
- `client/main/.env.local` — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, Supabase public keys
- Worker secrets managed via `wrangler secret put AUTOMATION_SECRET`; `SERVER_URL` is `https://api.stoneoven.in` per `worker/wrangler.toml`

**Build configs:**
- Server: `server/tsconfig.json`
- CMS: Next.js config in `client/cms/`
- Main: Next.js config in `client/main/`
- Worker: `worker/wrangler.toml`
- Netlify deploy: `netlify.toml` (base: `client/main`, plugin: `@netlify/plugin-nextjs`)

**Mock API toggle:**
- CMS: `NEXT_PUBLIC_MOCK_API=true` swaps real Axios instance for `client/cms/src/lib/mock-api.ts`

## Platform Requirements

**Development:**
- Node.js >=20, npm >=10
- PostgreSQL (via `DATABASE_URL`)
- Supabase project (auth)
- Ports: 8080 (server), 3000 (main client), 3001 (CMS client)

**Production:**
- Server: Docker (`docker-compose.yml`) or Render → `api.stoneoven.in`
- Main client: Netlify → `stoneoven.in`
- CMS client: Vercel (noted in `docker-compose.yml` comments)
- Worker: Cloudflare Workers (`stoneoven-automation`), daily cron

---

*Stack analysis: 2026-04-28*
