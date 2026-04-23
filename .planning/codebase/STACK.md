# Technology Stack

**Analysis Date:** 2026-04-24

## Summary

StoneOven is a TypeScript monorepo with three application packages: `client/main` (Next.js 16, customer QR flow on port 3000), `client/cms` (Next.js 16, staff CMS portal on port 3001), and `server` (Express 5 + Prisma 7, REST API on port 8080). A fourth package `worker` is a Cloudflare Worker acting as a daily cron scheduler. All packages use strict TypeScript with no JavaScript source files.

---

## Languages

**Primary:**
- TypeScript ^5.x — `client/main`, `client/cms`, `worker`
- TypeScript ^6.0.3 (devDep) — `server` (compiled to CommonJS via `tsc`)

No `.js` source files exist in any `src/` directory.

---

## Runtime & Ports

| Package | Runtime | Port | Dev Command |
|---------|---------|------|-------------|
| `client/main` | Node.js (Next.js) | 3000 | `next dev -p 3000` |
| `client/cms`  | Node.js (Next.js) | 3001 | `next dev -p 3001` |
| `server`      | Node.js 20+       | 8080 | `ts-node-dev --respawn --transpile-only src/index.ts` |
| `worker`      | Cloudflare Workers runtime | N/A | `wrangler dev` |

Package manager: **npm** — lockfiles present in all four packages.

---

## Frameworks

### client/main (`stoneoven-main`)

- **Next.js 16.2.4** — App Router, React 19, `src/app/` directory layout
- **React 19** + React DOM 19
- **Tailwind CSS ^3.4.4** — utility-first CSS; config in `client/main/tailwind.config.*`
- **Framer Motion ^12** — page/component animations
- **React Hook Form ^7.51.5** + `@hookform/resolvers ^5` — form state management
- **Zod ^4** — runtime schema validation
- **Axios ^1.7.2** — HTTP client wrapping all backend calls (`src/lib/api.ts`)
- **react-hot-toast ^2.4.1** — toast notifications
- **date-fns ^4** — date utilities
- **recharts ^3** — charts (analytics)
- **@radix-ui/react-avatar ^1.1.11** — accessible avatar primitive

### client/cms (`stoneoven-cms`)

- **Next.js 16.2.4** — App Router, React 19, `src/app/(cms)/` route group
- **React 19** + React DOM 19
- **Tailwind CSS ^3.4.4**
- **class-variance-authority ^0.7.1** — variant-based component styling
- **tailwind-merge ^2.5.2** — class deduplication (`cn()` helper)
- **lucide-react ^0.468.0** — icon set
- **React Hook Form ^7.51.5** + **Zod ^4**
- **Axios ^1.7.2** — HTTP client (`client/cms/src/lib/api.ts`)
- **react-hot-toast ^2.4.1**
- **date-fns ^4**
- **@radix-ui/react-avatar ^1.1.11**

### server

- **Express ^5.2.1** — HTTP server (Express 5, not 4)
- **Prisma ^7.7.0** — ORM; generated client at `server/generated/prisma/`
- **`@prisma/adapter-pg` ^7.7.0** — PostgreSQL driver adapter for Prisma 7
- **`pg` ^8.20.0** — PostgreSQL connection pool (`pg.Pool`)
- **multer ^2.1.1** — multipart file upload (menu images, memory storage, 5 MB limit)
- **cors ^2.8.6** — CORS middleware; allowed origins from `CORS_ORIGINS` env var
- **jsonwebtoken ^9.0.3** — JWT sign/verify
- **zod ^4.3.6** — request body validation
- **csv-stringify ^6.7.0** — CSV export endpoints (`/api/cms/export`)
- **dotenv ^17.4.2** — environment variable loading
- **cloudinary ^2.9.0** — image upload SDK (`server/src/lib/cloudinary.ts`)
- **resend ^6.12.2** — transactional email SDK (installed; currently in DRY_RUN mode)
- **twilio ^6.0.0** — WhatsApp messaging SDK (installed; currently in DRY_RUN mode)

### worker (`stoneoven-automation-worker`)

- **Cloudflare Workers** runtime (no Node.js)
- **wrangler ^3.0.0** — deploy CLI (`wrangler deploy`, `wrangler dev`)
- **`@cloudflare/workers-types` ^4.20241230.0** — TypeScript types for Workers API

---

## Database & ORM

- **PostgreSQL** — hosted on Supabase, connection via `DATABASE_URL` pooler (`aws-1-ap-northeast-1`)
- **Prisma 7.7.0**
  - **Canonical schema:** `server/generated/prisma/schema.prisma`
  - `server/prisma/schema.prisma` is intentionally empty — do not edit it
  - Generated Prisma Client output: `server/generated/prisma/`
  - Connection: `pg.Pool` → `PrismaPg` adapter → `PrismaClient` (singleton in `server/src/lib/prisma.ts`)
- **Database models:** `Outlet`, `Customer`, `CustomerVisit`, `Review`, `MenuCategory`, `MenuItem`, `AutomationLog`, `Staff`

---

## Authentication

### CMS Staff (`client/cms` + `server`)
- **Supabase Auth** — JWT tokens issued by Supabase
- Server-side verification: `supabaseAdmin.auth.getUser(token)` in `server/src/middleware/auth.ts`
- Client stores tokens in cookies: `cms_token` (access), `cms_refresh_token`, `cms_user` (7-day expiry)
- Next.js middleware at `client/cms/src/middleware.ts` guards all routes except `/login`
- RBAC roles: `admin` (UniCord), `owner` (Nitesh — all outlets), `franchise_owner` (single outlet)

### Customer (`client/main`)
- **FingerprintJS `@fingerprintjs/fingerprintjs ^5`** — browser device fingerprinting
- No passwords — identity is `deviceId` (FP `visitorId`)
- Fallback: `fallback-{timestamp}-{random}` on FP failure
- Fingerprint initialisation: `client/main/src/lib/fingerprint.ts`

---

## Build Tooling

| Tool | Version | Package |
|------|---------|---------|
| TypeScript | ^5 | all clients |
| TypeScript | ^6.0.3 | server (devDep) |
| ESLint | ^9 + eslint-config-next | clients |
| PostCSS + Autoprefixer | ^8 / ^10 | clients |
| ts-node-dev | ^2.0.0 | server dev runner |
| wrangler | ^3.0.0 | worker deploy |
| tsc | — | server production build → `server/dist/` |

---

## TypeScript Configurations

**`server/tsconfig.json`** — `target: ES2020`, `module: commonjs`, `strict: true`, `outDir: ./dist`

**`worker/tsconfig.json`** — `target: ES2022`, `module: ES2022`, `moduleResolution: bundler`, `types: ["@cloudflare/workers-types"]`

**clients** — standard Next.js tsconfig; path alias `@/` maps to `src/`

---

## DNS Override (server)

`server/src/index.ts` overrides DNS servers to Google (`8.8.8.8`, `8.8.4.4`, `1.1.1.1`) and forces IPv4-first resolution because local DNS does not resolve `*.supabase.co` domains.

---

*Stack analysis: 2026-04-24*
