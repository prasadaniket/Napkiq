# Codebase Structure

**Analysis Date:** 2026-04-28

## Directory Layout

```
StoneOven/
├── client/
│   ├── cms/                        # Next.js 14 CMS dashboard
│   │   ├── public/                 # Static assets (logo, diagrams)
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (cms)/          # Auth-guarded route group
│   │       │   │   ├── layout.tsx  # CMS shell + AuthProvider
│   │       │   │   ├── dashboard/
│   │       │   │   ├── customers/
│   │       │   │   │   └── [id]/
│   │       │   │   ├── outlets/
│   │       │   │   │   └── [id]/
│   │       │   │   ├── visits/
│   │       │   │   ├── reviews/
│   │       │   │   ├── menu/
│   │       │   │   ├── automation/
│   │       │   │   └── media/
│   │       │   ├── login/
│   │       │   ├── layout.tsx      # Root layout
│   │       │   └── page.tsx        # Redirects to /dashboard
│   │       ├── components/
│   │       │   ├── cms/            # Page-level UI (ReviewCard)
│   │       │   ├── layout/         # CMSSidebar
│   │       │   └── login/          # Login form component
│   │       ├── context/            # AuthContext.tsx
│   │       ├── hooks/              # useAuth.ts
│   │       ├── lib/                # api.ts, auth.ts, utils.ts, validators.ts
│   │       ├── styles/             # Global CSS
│   │       ├── types/              # api.ts (all CMS TS interfaces), outlet.ts
│   │       └── utils/supabase/     # client.ts, server.ts
│   │
│   ├── main/                       # Next.js 14 customer-facing app
│   │   ├── public/
│   │   │   ├── images/logo/        # logo.jpg
│   │   │   ├── images/menu/        # Static menu images (legacy)
│   │   │   └── qr-codes/           # Generated QR code PNGs
│   │   └── src/
│   │       ├── app/
│   │       │   ├── [code]/         # Dynamic outlet route (slug or code)
│   │       │   │   ├── page.tsx    # Outlet landing page
│   │       │   │   ├── menu/       # DB-driven menu page
│   │       │   │   ├── feedback/   # First-visit form
│   │       │   │   └── review/     # Repeat review form
│   │       │   ├── api/fingerprint/ # Next.js API route (server-side FP)
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx        # Homepage
│   │       ├── components/
│   │       │   ├── boisar/         # Legacy Boisar outlet component
│   │       │   ├── form1/          # feedback.tsx (first-visit form)
│   │       │   ├── form2/          # review.tsx (repeat review form)
│   │       │   ├── home/           # Homepage content
│   │       │   ├── layout/         # Footer
│   │       │   ├── map/            # Map page component
│   │       │   ├── menu/           # Menu UI components + legacy per-outlet menus
│   │       │   ├── palghar/        # Legacy Palghar outlet component
│   │       │   ├── social/         # Social links page
│   │       │   ├── ui/             # Shared primitives (Button, Input, Loader, Modal, etc.)
│   │       │   ├── vasai/          # Legacy Vasai outlet component
│   │       │   └── virar/          # Legacy Virar outlet component
│   │       ├── hooks/
│   │       │   ├── useAuth.ts
│   │       │   ├── useCustomer.ts
│   │       │   ├── useDeviceFingerprint.ts
│   │       │   └── useOutlet.ts
│   │       ├── lib/
│   │       │   ├── api.ts          # Axios client (real + mock switch)
│   │       │   ├── auth.ts
│   │       │   ├── fingerprint.ts  # Device fingerprint generation
│   │       │   ├── mock-api.ts     # Mock responses for local dev
│   │       │   ├── outletConfig.ts # Per-outlet feature flags (hasMenu)
│   │       │   ├── utils.ts
│   │       │   └── validators.ts
│   │       ├── styles/
│   │       ├── types/
│   │       │   ├── api.ts
│   │       │   ├── customer.ts
│   │       │   ├── menu.ts         # MenuItem, MenuCategory interfaces
│   │       │   ├── outlet.ts
│   │       │   └── review.ts
│   │       └── utils/supabase/
│   │
│   └── shared/types/               # (Reserved — currently unused)
│
└── server/
    ├── data/                       # Seed data files
    ├── generated/prisma/           # Prisma-generated client (committed)
    └── src/
        ├── app.ts                  # Express app factory + route mounting
        ├── index.ts                # Server entry point (listen)
        ├── lib/
        │   ├── cloudinary.ts       # Cloudinary client + MENU_FOLDER constant
        │   ├── notifications.ts    # WhatsApp + email send helpers
        │   ├── paginate.ts         # Pagination utility
        │   ├── prisma.ts           # Prisma singleton
        │   ├── supabase.ts         # Supabase admin client
        │   └── templateStore.ts    # Automation template store
        ├── middleware/
        │   ├── auth.ts             # requireAuth, requireAdmin, requireOwnerOrAbove
        │   └── errorHandler.ts     # Global Express error handler
        ├── routes/
        │   ├── auth.ts             # POST /api/auth/login, GET /api/auth/me
        │   ├── automation.ts       # POST /api/automation (dual-auth: worker secret OR JWT)
        │   ├── customers.ts        # POST /api/customers, GET /api/customers/by-device/:id
        │   ├── menu.ts             # GET /api/menu/outlet/:code (public)
        │   ├── outlets.ts          # GET /api/outlets/:code (public)
        │   ├── reviews.ts          # POST /api/reviews (public)
        │   ├── visits.ts           # POST /api/visits (public)
        │   └── cms/
        │       ├── automationLogs.ts
        │       ├── automationTemplates.ts
        │       ├── customers.ts
        │       ├── dashboard.ts
        │       ├── export.ts
        │       ├── menu.ts         # Full CRUD for categories + items + image upload
        │       ├── outlets.ts
        │       ├── qr.ts
        │       ├── reviews.ts
        │       └── visits.ts
        ├── scripts/                # One-off admin scripts (seed, wipe, setup staff)
        │   ├── seed_boisar_menu.ts
        │   ├── setup_staff.ts
        │   ├── wipe_data.ts
        │   └── remove_old_staff.ts
        └── services/
            ├── BaseService.ts      # Prisma client + paginate helper
            ├── QRService.ts        # QR code generation
            └── SentimentService.ts # Review sentiment analysis
```

## Directory Purposes

**`server/src/routes/` (public):**
- Purpose: Unauthenticated endpoints consumed by the customer app
- Contains: `auth.ts`, `customers.ts`, `visits.ts`, `reviews.ts`, `outlets.ts`, `menu.ts`, `automation.ts`
- Key files: `server/src/routes/menu.ts` (public menu fetch), `server/src/routes/visits.ts` (QR visit recording)

**`server/src/routes/cms/`:**
- Purpose: Protected endpoints consumed by the CMS app — all require `requireAuth`
- Contains: Full CRUD routers for all entities
- Key file: `server/src/routes/cms/menu.ts` — categories + items CRUD + Cloudinary image upload/delete

**`server/src/lib/`:**
- Purpose: Singleton clients and shared utilities (not HTTP-layer logic)
- Key files: `prisma.ts` (Prisma singleton), `supabase.ts` (Supabase admin), `cloudinary.ts` (image CDN), `notifications.ts` (messaging)

**`server/src/middleware/`:**
- Purpose: Express middleware applied at router or app level
- Key file: `auth.ts` — do not modify role names without updating `schema.prisma` and `AuthContext.tsx`

**`client/cms/src/app/(cms)/`:**
- Purpose: All CMS pages — wrapped by `layout.tsx` which enforces auth guard
- Naming: One directory per domain (customers, outlets, visits, reviews, menu, automation, media)

**`client/cms/src/types/api.ts`:**
- Purpose: Single source of truth for all CMS TypeScript interfaces — `LoginResponse`, `Customer`, `Review`, `Visit`, `Outlet`, `MenuItem`, `MenuCategory`, `AutomationTemplate`, etc.
- Rule: Add new response types here, not inline in page files

**`client/main/src/app/[code]/`:**
- Purpose: All customer-facing pages for a given outlet — resolved by slug or outlet code
- Contains: `page.tsx` (landing), `menu/page.tsx`, `feedback/page.tsx`, `review/page.tsx`

**`client/main/src/components/menu/`:**
- Purpose: Reusable menu UI components + legacy per-outlet static menus
- Active components: `MenuCategorySection.tsx`, `MenuItemCard.tsx`, `MenuSearch.tsx`
- Legacy (static): `boisarmenu.tsx`, `palgharmenu.tsx`, `vasaimenu.tsx`, `virarmenu.tsx`, `page1-4.tsx` — superseded by DB-driven menu

**`client/main/src/components/ui/`:**
- Purpose: Generic primitives shared across forms and pages
- Contains: `Button.tsx`, `Input.tsx`, `Select.tsx`, `DatePicker.tsx`, `StarRating.tsx`, `Loader.tsx`, `Modal.tsx`, `avatar.tsx`

**`client/main/src/components/{boisar,palghar,vasai,virar}/`:**
- Purpose: Legacy per-outlet landing components — predates dynamic `[code]` routing
- Status: Superseded by `app/[code]/page.tsx`; retained but no longer used as primary pages

**`server/src/scripts/`:**
- Purpose: One-off admin scripts — run with `ts-node` or `npx tsx`, never via HTTP
- Key script: `seed_boisar_menu.ts` — seeded 11 categories and 61 items for Boisar outlet

## Key File Locations

**Entry Points:**
- `server/src/index.ts` — Express server listen
- `server/src/app.ts` — Route mounting and CORS config
- `client/main/src/app/[code]/page.tsx` — Customer outlet landing (QR target)
- `client/cms/src/app/(cms)/layout.tsx` — CMS shell + auth guard

**Configuration:**
- `client/main/src/lib/outletConfig.ts` — Per-outlet `hasMenu` flag (update when menu goes live for new outlets)
- `server/generated/prisma/schema.prisma` — Database schema source of truth
- `server/src/app.ts` — CORS origins, route prefixes

**Core Logic:**
- `server/src/middleware/auth.ts` — JWT validation, role normalization, role guards
- `server/src/routes/cms/menu.ts` — Full menu CRUD with Cloudinary image management
- `server/src/routes/menu.ts` — Public menu fetch (outlet by slug OR code)
- `server/src/routes/visits.ts` — Visit recording with 1-hour dedup
- `client/cms/src/context/AuthContext.tsx` — CMS session and role flags
- `client/cms/src/lib/api.ts` — CMS Axios client with token refresh queue

**Types:**
- `client/cms/src/types/api.ts` — All CMS entity interfaces
- `client/main/src/types/menu.ts` — `MenuItem`, `MenuCategory` for customer app
- `client/main/src/lib/outletConfig.ts` — `OutletConfig` interface + record

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js App Router convention)
- Layouts: `layout.tsx`
- Components: PascalCase (`MenuCategorySection.tsx`, `CMSSidebar.tsx`)
- Hooks: camelCase with `use` prefix (`useCustomer.ts`, `useDeviceFingerprint.ts`)
- Lib/utils: camelCase (`fingerprint.ts`, `outletConfig.ts`)
- Server routes: camelCase module name matching the resource (`visits.ts`, `customers.ts`)

**Directories:**
- Route groups: lowercase with parentheses (`(cms)`)
- Dynamic segments: bracket notation (`[code]`, `[id]`)
- Feature components: lowercase resource name (`menu/`, `form1/`, `form2/`)
- CMS route dirs: lowercase resource name matching API path (`outlets/`, `customers/`)

## Where to Add New Code

**New CMS page (e.g., loyalty):**
- Create `client/cms/src/app/(cms)/loyalty/page.tsx`
- Add nav link in `client/cms/src/components/layout/CMSSidebar.tsx`
- Add API type interfaces to `client/cms/src/types/api.ts`

**New public API endpoint:**
- Create route file in `server/src/routes/{resource}.ts`
- Mount in `server/src/app.ts` under `app.use('/api/{resource}', router)`

**New CMS API endpoint (protected):**
- Create or extend file in `server/src/routes/cms/{resource}.ts`
- Mount in `server/src/app.ts` under `app.use('/api/cms/{resource}', router)`
- Apply `router.use(requireAuth)` at the top; add `requireAdmin` or `requireOwnerOrAbove` per route as needed

**New menu UI component:**
- Place in `client/main/src/components/menu/`
- Import in `client/main/src/app/[code]/menu/page.tsx`

**New outlet:**
- Add a `Staff` record and `Outlet` record in DB
- Add entry to `client/main/src/lib/outletConfig.ts` with `hasMenu: false` initially
- Set `hasMenu: true` once menu is seeded and verified

**One-off data script:**
- Create in `server/src/scripts/`
- Run with `npx tsx server/src/scripts/{name}.ts`

## Special Directories

**`server/generated/prisma/`:**
- Purpose: Prisma-generated client output
- Generated: Yes — via `npx prisma generate`
- Committed: Yes (for Render deployment compatibility)

**`server/data/`:**
- Purpose: Static seed/reference data files
- Generated: No
- Committed: Yes

**`client/main/public/qr-codes/`:**
- Purpose: QR code PNG files generated by `QRService`
- Generated: Yes (server-side via `server/src/services/QRService.ts`)
- Committed: Yes

**`client/main/src/components/{boisar,palghar,vasai,virar}/`:**
- Purpose: Legacy per-outlet static landing components, predating dynamic routing
- Status: No longer used as primary outlet pages; safe to delete once fully migrated

---

*Structure analysis: 2026-04-28*
