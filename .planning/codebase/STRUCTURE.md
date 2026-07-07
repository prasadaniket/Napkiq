# Codebase Structure

**Analysis Date:** 2026-07-07

## Directory Layout

```
Napkiq/
├── client/
│   ├── cms/                        # Next.js CMS dashboard (staff)
│   │   ├── public/                 # Static assets (logo, diagrams)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (cms)/          # Auth-guarded route group
│   │       │   │   ├── layout.tsx  # CMS shell + AuthProvider
│   │       │   │   ├── analytics/  # (was dashboard/) main stats page
│   │       │   │   ├── customers/
│   │       │   │   │   └── [id]/
│   │       │   │   ├── outlets/
│   │       │   │   │   └── [id]/
│   │       │   │   ├── visits/
│   │       │   │   ├── reviews/
│   │       │   │   ├── kds/         # Kitchen Display System (live order board)
│   │       │   │   ├── celebrations/ # Birthdays + anniversaries (merged panel)
│   │       │   │   ├── automation/
│   │       │   │   └── media/
│   │       │   ├── login/
│   │       │   ├── layout.tsx      # Root layout
│   │       │   └── page.tsx        # Redirects to /analytics
│   │       ├── components/
│   │       │   ├── cms/            # Page-level UI (ReviewCard)
│   │       │   ├── celebrations/   # BirthdaysPanel, AnniversariesPanel
│   │       │   ├── export/         # ExportModal (CSV/Excel export UI)
│   │       │   ├── orders/         # KitchenBoard, OrdersReport, MenuBuilder
│   │       │   ├── layout/         # CMSSidebar
│   │       │   └── login/          # Login form component
│   │       ├── context/            # AuthContext.tsx
│   │       ├── hooks/              # useAuth.ts
│   │       ├── lib/                # api.ts, auth.ts, utils.ts, validators.ts
│   │       ├── styles/             # globals.css (light-theme design tokens)
│   │       ├── types/              # api.ts (all CMS TS interfaces), outlet.ts
│   │       └── utils/supabase/     # client.ts, server.ts
│   │
│   ├── main/                       # Next.js customer-facing app
│   │   ├── public/
│   │   │   ├── images/logo/        # logo.jpg
│   │   │   ├── images/menu/        # Static menu images (legacy)
│   │   │   └── qr-codes/           # Generated QR code PNGs
│   │   └── src/
│   │       ├── app/
│   │       │   ├── [code]/         # Dynamic outlet route (slug or code)
│   │       │   │   ├── page.tsx    # Outlet landing page
│   │       │   │   ├── menu/       # DB-driven menu + order cart
│   │       │   │   ├── order/[id]/ # Single-order live tracking page
│   │       │   │   ├── orders/     # This device's order history
│   │       │   │   ├── feedback/   # First-visit form
│   │       │   │   └── review/     # Repeat review form
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx        # Homepage
│   │       ├── components/         # menu/, form1/, form2/, home/, ui/, layout/, map/, social/, + legacy per-outlet dirs
│   │       ├── hooks/              # useAuth, useCustomer, useDeviceFingerprint, useOutlet
│   │       ├── lib/                # api.ts, fingerprint.ts, mock-api.ts, outletConfig.ts, validators.ts, utils.ts
│   │       ├── styles/
│   │       ├── types/              # api.ts, customer.ts, menu.ts, outlet.ts, review.ts
│   │       └── utils/supabase/
│   │
│   └── shared/types/               # (Reserved — currently unused)
│
├── worker/                         # Cloudflare Worker (daily automation cron)
│   ├── src/index.ts
│   └── wrangler.toml               # name: napkiq-automation
│
└── server/
    ├── data/                       # Seed data files
    ├── generated/prisma/           # Prisma-generated client (committed)
    ├── prisma/schema.prisma        # Schema source of truth
    └── src/
        ├── app.ts                  # Express app factory + route mounting
        ├── index.ts                # Server entry point (listen)
        ├── lib/
        │   ├── cloudinary.ts       # Cloudinary client + MENU_FOLDER constant
        │   ├── notifications.ts    # WhatsApp (WaSenderAPI) + email send helpers
        │   ├── orders.ts           # createOrderWithItems, IST business-day token allocation
        │   ├── orderEvents.ts      # In-process SSE event broker (KDS fan-out)
        │   ├── paginate.ts         # Pagination utility
        │   ├── prisma.ts           # Prisma singleton
        │   ├── supabase.ts         # Supabase admin client
        │   └── templateStore.ts    # Automation template store
        ├── middleware/
        │   ├── auth.ts             # resolveStaffFromToken, requireAuth, requireAdmin, requireOwnerOrAbove
        │   ├── rateLimit.ts        # general/auth/write/automation limiters
        │   └── errorHandler.ts     # Global Express error handler
        ├── routes/
        │   ├── auth.ts             # POST /api/auth/login, GET /api/auth/me
        │   ├── automation.ts       # POST /api/automation (dual-auth: worker secret OR JWT)
        │   ├── customers.ts        # POST /api/customers, GET /api/customers/by-device/:id
        │   ├── menu.ts             # GET /api/menu/outlet/:code (public)
        │   ├── orders.ts           # POST /api/orders + by-device + :id + :id/stream + cancel (public)
        │   ├── outlets.ts          # GET /api/outlets/:code (public)
        │   ├── reviews.ts          # POST /api/reviews (public)
        │   ├── visits.ts           # POST /api/visits (public)
        │   └── cms/
        │       ├── automationLogs.ts
        │       ├── automationTemplates.ts
        │       ├── customers.ts
        │       ├── dashboard.ts    # analytics stats
        │       ├── export.ts       # CSV + Excel export (admin only)
        │       ├── menu.ts         # Full CRUD for categories + items + image upload
        │       ├── orders.ts       # KDS stream (SSE) + order list/report + status updates
        │       ├── outlets.ts
        │       ├── qr.ts
        │       ├── reviews.ts
        │       └── visits.ts
        ├── scripts/                # One-off admin scripts (run with npx tsx)
        │   ├── setup_staff.ts
        │   ├── check_automation_logs.ts
        │   └── inspect_outlets.ts
        └── services/
            ├── BaseService.ts      # Prisma client + paginate helper
            ├── QRService.ts        # QR code generation
            └── SentimentService.ts # Review sentiment analysis
```

## Directory Purposes

**`server/src/routes/` (public):**
- Purpose: Unauthenticated endpoints consumed by the customer app
- Contains: `auth.ts`, `customers.ts`, `visits.ts`, `reviews.ts`, `outlets.ts`, `menu.ts`, `orders.ts`, `automation.ts`
- Public writes are protected by `writeLimiter` (registration, reviews, visits, order create/cancel)

**`server/src/routes/cms/`:**
- Purpose: Protected endpoints consumed by the CMS app — all require `requireAuth`
- Exception: `GET /api/cms/orders/stream` (KDS SSE) authenticates via a `?token=` query param instead of the Bearer header, because `EventSource` cannot send headers
- Key file: `server/src/routes/cms/orders.ts` — KDS live feed + order report + status transitions

**`server/src/lib/`:**
- Purpose: Singleton clients and shared non-HTTP logic
- Key files: `prisma.ts`, `supabase.ts`, `cloudinary.ts`, `notifications.ts`, `orders.ts` (order creation + IST token allocation), `orderEvents.ts` (SSE broker)

**`server/src/middleware/`:**
- Purpose: Express middleware applied at router or app level
- Key files: `auth.ts` (do not rename roles without updating `schema.prisma` and `AuthContext.tsx`), `rateLimit.ts` (limiter factory)

**`client/cms/src/app/(cms)/`:**
- Purpose: All CMS pages — wrapped by `layout.tsx` which enforces the auth guard
- Pages: analytics, outlets, customers, reviews, visits, kds, celebrations, automation, media
- Note: the standalone `menu/` page was removed — menu content is now managed through `components/orders/MenuBuilder.tsx`

**`client/cms/src/components/orders/`:**
- `KitchenBoard.tsx` — the live KDS order board (consumes the SSE stream)
- `OrdersReport.tsx` — historical orders report
- `MenuBuilder.tsx` — menu category/item CRUD UI

**`client/cms/src/types/api.ts`:**
- Purpose: Single source of truth for all CMS TypeScript interfaces
- Rule: Add new response types here, not inline in page files

**`client/main/src/app/[code]/`:**
- Purpose: All customer-facing pages for a given outlet — resolved by slug or outlet code
- Contains: `page.tsx` (landing), `menu/` (menu + cart), `order/[id]/` (order tracking), `orders/` (device history), `feedback/`, `review/`

**`server/src/scripts/`:**
- Purpose: One-off admin scripts — run with `npx tsx server/src/scripts/{name}.ts`, never via HTTP
- `setup_staff.ts` reads staff credentials from env vars

## Key File Locations

**Entry Points:**
- `server/src/index.ts` — Express server listen
- `server/src/app.ts` — Route mounting, CORS, rate limiting, `trust proxy`
- `client/main/src/app/[code]/page.tsx` — Customer outlet landing (QR target)
- `client/cms/src/app/(cms)/layout.tsx` — CMS shell + auth guard

**Configuration:**
- `client/main/src/lib/outletConfig.ts` — Per-outlet `hasMenu` flag (all outlets currently `true`)
- `server/prisma/schema.prisma` — Database schema source of truth
- `server/src/app.ts` — CORS origins, route prefixes, limiter wiring
- `worker/wrangler.toml` — Cloudflare Worker cron config

**Core Logic:**
- `server/src/middleware/auth.ts` — Supabase token → Staff resolution, role guards
- `server/src/lib/orders.ts` — Shared order creation, server-side price snapshotting, daily token numbers
- `server/src/lib/orderEvents.ts` — In-process pub/sub bridging order writes → KDS SSE
- `server/src/routes/cms/menu.ts` — Full menu CRUD with Cloudinary image management
- `server/src/routes/visits.ts` — Visit recording with 1-hour dedup
- `client/cms/src/context/AuthContext.tsx` — CMS session and role flags
- `client/cms/src/lib/api.ts` — CMS Axios client with token refresh queue

**Types:**
- `client/cms/src/types/api.ts` — All CMS entity interfaces
- `client/main/src/types/menu.ts` — `MenuItem`, `MenuCategory` for customer app
- `client/main/src/lib/outletConfig.ts` — `OutletConfig` interface + record

## Naming Conventions

**Files:**
- Pages: `page.tsx`; Layouts: `layout.tsx`
- Components: PascalCase (`KitchenBoard.tsx`, `CMSSidebar.tsx`)
- Hooks: camelCase with `use` prefix
- Lib/utils: camelCase (`orders.ts`, `orderEvents.ts`, `outletConfig.ts`)
- Server routes: camelCase module name matching the resource

**Directories:**
- Route groups: lowercase with parentheses (`(cms)`)
- Dynamic segments: bracket notation (`[code]`, `[id]`)
- Feature components: lowercase resource name (`orders/`, `celebrations/`, `export/`)

## Where to Add New Code

**New CMS page:**
- Create `client/cms/src/app/(cms)/{name}/page.tsx`
- Add nav link in `client/cms/src/components/layout/CMSSidebar.tsx` (to `adminNav`/`ownerNav`/`franchiseNav` as appropriate)
- Add API type interfaces to `client/cms/src/types/api.ts`

**New public API endpoint:**
- Create route file in `server/src/routes/{resource}.ts`, apply `writeLimiter` to public writes
- Mount in `server/src/app.ts` under `app.use('/api/{resource}', router)`

**New CMS API endpoint (protected):**
- Create or extend `server/src/routes/cms/{resource}.ts`
- Mount in `server/src/app.ts` under `app.use('/api/cms/{resource}', router)`
- Apply `router.use(requireAuth)`; add `requireAdmin`/`requireOwnerOrAbove` per route as needed

**New outlet:**
- Add `Staff` + `Outlet` records in DB
- Add entry to `client/main/src/lib/outletConfig.ts`

**One-off data script:**
- Create in `server/src/scripts/`; run with `npx tsx server/src/scripts/{name}.ts`

## Special Directories

**`server/generated/prisma/`:**
- Prisma-generated client output; committed for Render deploy compatibility

**`server/data/`:**
- Static seed/reference data; committed

**`client/main/public/qr-codes/`:**
- QR PNGs generated server-side via `QRService`; committed

---

*Structure analysis: 2026-07-07*
