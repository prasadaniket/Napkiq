# Codebase Structure

**Analysis Date:** 2026-04-24

## Top-Level Layout

```
StoneOven/
├── client/
│   ├── main/          # Public customer frontend (stoneoven.in)
│   ├── cms/           # CMS admin frontend (stoneoven.in/cms)
│   └── shared/        # Placeholder — no shared code yet (empty)
├── server/            # Express REST API (api.stoneoven.in)
├── .planning/
│   └── codebase/      # Codebase map documents (this file)
└── .git/
```

---

## server/

```
server/
├── src/
│   ├── index.ts             # Entrypoint: DNS override, createApp(), listen()
│   ├── app.ts               # Express factory: CORS, middleware, route mounting
│   ├── middleware/
│   │   ├── auth.ts          # requireAuth, requireAdmin, requireOwnerOrAbove
│   │   └── errorHandler.ts  # Global Express error handler
│   ├── routes/
│   │   ├── outlets.ts       # GET /api/outlets, GET /api/outlets/:code
│   │   ├── customers.ts     # GET /api/customers/by-device/:id, POST /api/customers
│   │   ├── visits.ts        # POST /api/visits
│   │   ├── reviews.ts       # POST /api/reviews
│   │   ├── menu.ts          # GET /api/menu (public)
│   │   ├── auth.ts          # POST /api/auth/login, POST /api/auth/refresh, GET /api/auth/me
│   │   ├── automation.ts    # POST /api/automation/run, POST /api/automation/reengagement
│   │   └── cms/
│   │       ├── dashboard.ts      # GET /api/cms/dashboard/stats
│   │       ├── customers.ts      # GET /api/cms/customers, GET /api/cms/customers/:id
│   │       ├── reviews.ts        # GET /api/cms/reviews
│   │       ├── outlets.ts        # GET /api/cms/outlets, /stats, /:id
│   │       ├── visits.ts         # GET /api/cms/visits, /summary
│   │       ├── automationLogs.ts # GET /api/cms/automation-logs
│   │       ├── export.ts         # GET /api/cms/export/customers, /visits (CSV)
│   │       └── menu.ts           # Full CRUD /api/cms/menu + image upload/delete
│   ├── lib/
│   │   ├── prisma.ts        # Prisma client singleton
│   │   ├── supabase.ts      # Supabase admin client (service role key)
│   │   ├── cloudinary.ts    # Cloudinary v2 config + MENU_FOLDER constant
│   │   ├── notifications.ts # sendWhatsApp(), sendEmail(), template builders (DRY_RUN until APIs wired)
│   │   └── paginate.ts      # paginate<T>() utility → { content, totalElements, totalPages, ... }
│   └── scripts/
│       ├── setup_staff.ts        # One-time: create staff records in DB + Supabase Auth
│       ├── remove_old_staff.ts   # One-time: remove deprecated staff accounts
│       └── wipe_data.ts          # Dev utility: clear all customer/visit/review data
└── generated/
    └── prisma/
        └── schema.prisma    # Prisma schema (source of truth for DB models)
```

### Key server files

| File | Purpose |
|------|---------|
| `server/src/app.ts` | All route mounts are here — start here to trace any endpoint |
| `server/src/middleware/auth.ts` | All RBAC logic lives here — `requireAuth`, `requireAdmin`, `requireOwnerOrAbove` |
| `server/src/routes/automation.ts` | Automation cron handler + manual reengagement + dual-auth pattern |
| `server/src/lib/notifications.ts` | WhatsApp (Twilio) and Email (Resend) stubs + HTML email builders |
| `server/generated/prisma/schema.prisma` | DB schema — models: Outlet, Customer, CustomerVisit, Review, MenuItem, MenuCategory, AutomationLog, Staff |

---

## client/main/

Public customer-facing app — served at `stoneoven.in`.

```
client/main/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (fonts, globals)
│   │   ├── page.tsx                      # Home page (stoneoven.in/)
│   │   ├── outlet/
│   │   │   └── [code]/
│   │   │       ├── page.tsx              # QR landing page — visit record + CTAs
│   │   │       ├── feedback/page.tsx     # First-visit registration form
│   │   │       ├── review/page.tsx       # Repeat review form
│   │   │       └── menu/page.tsx         # Dynamic menu (API-driven)
│   │   ├── boisar/
│   │   │   ├── page.tsx                  # Static Boisar outlet page
│   │   │   └── menu/page.tsx             # Static Boisar menu
│   │   ├── palghar/page.tsx              # Static Palghar outlet page
│   │   ├── virar/page.tsx                # Static Virar outlet page
│   │   ├── vasai/page.tsx                # Static Vasai outlet page
│   │   └── api/
│   │       └── fingerprint/              # (Next.js API route placeholder)
│   ├── components/
│   │   ├── form1/
│   │   │   └── feedback.tsx              # First-visit registration form component
│   │   ├── form2/
│   │   │   └── review.tsx                # Repeat review form component
│   │   ├── menu/
│   │   │   ├── MenuCategorySection.tsx   # Category accordion/section
│   │   │   ├── MenuItemCard.tsx          # Individual menu item display
│   │   │   ├── MenuSearch.tsx            # Search bar for menu
│   │   │   ├── boisarmenu.tsx            # Static Boisar menu (legacy)
│   │   │   ├── palgharmenu.tsx           # Static Palghar menu (legacy)
│   │   │   ├── virarmenu.tsx             # Static Virar menu (legacy)
│   │   │   ├── vasaimenu.tsx             # Static Vasai menu (legacy)
│   │   │   └── page1-4.tsx               # Static menu page components (legacy)
│   │   ├── ui/
│   │   │   ├── Loader.tsx                # Spinner component
│   │   │   ├── Button.tsx                # Shared button
│   │   │   ├── Input.tsx                 # Shared input
│   │   │   ├── Select.tsx                # Shared select
│   │   │   ├── DatePicker.tsx            # Date picker for forms
│   │   │   ├── StarRating.tsx            # Star rating input
│   │   │   ├── Modal.tsx                 # Modal wrapper
│   │   │   └── avatar.tsx                # Avatar component (from shadcn)
│   │   ├── layout/
│   │   │   └── Footer.tsx                # Footer with UniCord credit
│   │   ├── map/mappage.tsx               # Google Maps embed
│   │   ├── social/socialpage.tsx         # Social links section
│   │   ├── home/page.tsx                 # Home page content
│   │   ├── boisar/boisar.tsx             # Boisar outlet static content
│   │   ├── palghar/palghar.tsx           # Palghar outlet static content
│   │   ├── virar/virar.tsx               # Virar outlet static content
│   │   └── vasai/vasai.tsx               # Vasai outlet static content
│   ├── hooks/
│   │   ├── useDeviceFingerprint.ts       # FingerprintJS integration → stable deviceId
│   │   ├── useCustomer.ts                # GET /api/customers/by-device/:id
│   │   ├── useOutlet.ts                  # GET /api/outlets/:code
│   │   └── useAuth.ts                    # (Auth hook — not used in public app)
│   ├── lib/
│   │   ├── api.ts                        # Axios instance with baseURL = NEXT_PUBLIC_API_URL
│   │   ├── fingerprint.ts                # getDeviceFingerprint() — FingerprintJS wrapper
│   │   ├── outletConfig.ts               # Static outlet config map (slug → name/location)
│   │   ├── auth.ts                       # Auth helpers (not actively used in public flow)
│   │   ├── validators.ts                 # Form validation helpers
│   │   ├── utils.ts                      # General utilities
│   │   ├── clipboard.ts                  # Clipboard utility
│   │   └── mock-api.ts                   # Mock API responses (dev only)
│   ├── types/
│   │   ├── api.ts                        # API response types
│   │   ├── customer.ts                   # Customer type
│   │   ├── outlet.ts                     # Outlet type
│   │   ├── review.ts                     # Review type
│   │   └── menu.ts                       # Menu types
│   ├── utils/
│   │   └── supabase/
│   │       ├── client.ts                 # Supabase browser client (not actively used in public flow)
│   │       └── server.ts                 # Supabase server client (not actively used in public flow)
│   └── styles/                           # Global CSS
└── public/
    ├── images/
    │   ├── logo/logo.jpg                 # StoneOven logo
    │   └── menu/                         # Static menu images (legacy)
    └── qr-codes/                         # QR code PNGs per outlet
```

### Key client/main files

| File | Purpose |
|------|---------|
| `client/main/src/app/outlet/[code]/page.tsx` | Core QR journey entry point — records visit, shows CTAs |
| `client/main/src/components/form1/feedback.tsx` | First-visit form (collects customer data + first review) |
| `client/main/src/components/form2/review.tsx` | Repeat review form |
| `client/main/src/hooks/useDeviceFingerprint.ts` | Device identity hook — must be called before any customer API call |
| `client/main/src/lib/fingerprint.ts` | FingerprintJS singleton loader — module-scoped promise cache |
| `client/main/src/lib/outletConfig.ts` | Static map of outlet slugs to display names — 4 outlets: boisar, palghar, virar, vasai |

---

## client/cms/

Admin portal — served at `stoneoven.in/cms`.

```
client/cms/
├── src/
│   ├── middleware.ts                     # Next.js middleware: checks cms_token cookie, redirects to /login
│   ├── app/
│   │   ├── layout.tsx                    # Root layout
│   │   ├── page.tsx                      # Root redirect → /dashboard
│   │   ├── login/page.tsx                # Login page (renders LoginPage component)
│   │   └── (cms)/                        # Route group — all authenticated pages share CMS layout
│   │       ├── layout.tsx                # CMS layout wrapper (CMSSidebar + AuthProvider)
│   │       ├── dashboard/page.tsx        # Dashboard — aggregate stats, outlet overview, admin shortcuts
│   │       ├── outlets/
│   │       │   ├── page.tsx              # Per-outlet performance cards (admin/owner only)
│   │       │   └── [id]/page.tsx         # Single outlet full analytics dashboard
│   │       ├── customers/
│   │       │   ├── page.tsx              # Paginated customer list with filters + search
│   │       │   └── [id]/page.tsx         # Customer profile — visits + reviews history
│   │       ├── reviews/page.tsx          # Paginated reviews list with outlet filter
│   │       ├── visits/page.tsx           # Paginated visits list — QR vs payment breakdown
│   │       ├── automation/page.tsx       # Automation templates + logs + manual re-engagement trigger
│   │       └── media/page.tsx            # Media/menu management (admin only)
│   ├── components/
│   │   ├── layout/
│   │   │   └── CMSSidebar.tsx            # Navigation sidebar with role-based menu items
│   │   ├── login/
│   │   │   └── loginpage.tsx             # Login form UI
│   │   └── cms/
│   │       └── ReviewCard.tsx            # Reusable review display card
│   ├── context/
│   │   └── AuthContext.tsx               # React context: user, isAdmin, isOwner, isFranchise, isOwnerOrAbove
│   ├── hooks/
│   │   └── useAuth.ts                    # Re-exports useAuth from AuthContext
│   ├── lib/
│   │   ├── api.ts                        # Axios instance — attaches Bearer token, handles 401 refresh
│   │   ├── auth.ts                       # Cookie helpers: saveSession, getToken, getRefreshToken, clearSession
│   │   ├── utils.ts                      # General utilities (cn, etc.)
│   │   └── validators.ts                 # Form validation helpers
│   ├── types/
│   │   ├── api.ts                        # Full API response types (LoginResponse, DashboardStats, OutletStats, PageResponse, etc.)
│   │   └── outlet.ts                     # Outlet type
│   ├── utils/
│   │   └── supabase/
│   │       ├── client.ts                 # Supabase browser client (session passthrough, not primary auth path)
│   │       └── server.ts                 # Supabase server client
│   ├── proxy.ts                          # (Proxy utility — not actively used in main flows)
│   └── styles/                           # Global CMS CSS (dark theme design tokens)
└── public/
    └── diagram/                          # Architecture diagram images
```

### Key client/cms files

| File | Purpose |
|------|---------|
| `client/cms/src/middleware.ts` | Route-level auth gate — redirects to `/login` if no `cms_token` cookie |
| `client/cms/src/context/AuthContext.tsx` | Single source of truth for auth state + role helpers across all CMS pages |
| `client/cms/src/lib/api.ts` | All API calls go through this axios instance — handles token injection + 401 refresh |
| `client/cms/src/lib/auth.ts` | Cookie-based session storage: `saveSession`, `getToken`, `clearSession` |
| `client/cms/src/types/api.ts` | Type definitions consumed by every CMS page — check here before making new API calls |
| `client/cms/src/app/(cms)/layout.tsx` | Wraps `AuthProvider` + `CMSSidebar` around all CMS pages |

---

## Naming Conventions

**Files:**
- Next.js pages: `page.tsx` (Next.js App Router convention)
- Components: PascalCase (e.g., `CMSSidebar.tsx`, `ReviewCard.tsx`)
- Hooks: camelCase prefixed with `use` (e.g., `useDeviceFingerprint.ts`)
- Lib utilities: camelCase (e.g., `fingerprint.ts`, `paginate.ts`)
- Server routes: camelCase matching resource name (e.g., `customers.ts`, `automationLogs.ts`)

**Directories:**
- CMS route group uses `(cms)` convention to share layout without affecting URL
- Server routes split into root-level (public) and `cms/` subdirectory (protected)
- Components grouped by feature/domain, not by type

---

## Where to Add New Code

**New public customer page:**
- Route: `client/main/src/app/outlet/[code]/[new-route]/page.tsx`
- Component: `client/main/src/components/[feature]/[Component].tsx`

**New CMS page:**
- Route: `client/cms/src/app/(cms)/[feature]/page.tsx`
- It automatically gets the CMS layout (sidebar + AuthProvider)
- Add nav link in `client/cms/src/components/layout/CMSSidebar.tsx`
- Add role guard inside the page using `useAuth()`

**New API endpoint:**
- Public: `server/src/routes/[resource].ts` + mount in `server/src/app.ts`
- CMS-protected: `server/src/routes/cms/[resource].ts` + mount under `/api/cms/` in `server/src/app.ts`
- Always apply `router.use(requireAuth)` at the top of CMS route files

**New DB model:**
- Add to `server/generated/prisma/schema.prisma`
- Run `npx prisma generate` to update the Prisma client

**New automation type:**
- Add enum values to `AutomationType` and `MessageStage` in `schema.prisma`
- Add sending logic in `server/src/routes/automation.ts` inside `runAutomation()`
- Add template builder in `server/src/lib/notifications.ts`
- Add template card to `TEMPLATES` array in `client/cms/src/app/(cms)/automation/page.tsx`

**New shared UI component (public):**
- `client/main/src/components/ui/[Component].tsx`

**New type definition:**
- CMS API types: `client/cms/src/types/api.ts`
- Public API types: `client/main/src/types/api.ts`
- (No shared type package between main and cms — duplicated as needed)

---

## Special Directories

**`server/generated/prisma/`**
- Purpose: Prisma client output (auto-generated from `schema.prisma`)
- Generated: Yes (`npx prisma generate`)
- Committed: Yes (schema.prisma is committed; generated client files may or may not be)

**`server/src/scripts/`**
- Purpose: One-time admin scripts run via `ts-node` directly (not part of the API)
- `setup_staff.ts` — creates initial staff records
- `wipe_data.ts` — development data reset

**`client/main/public/qr-codes/`**
- Purpose: QR code PNG files for each outlet — printed and placed on tables
- Generated: Manually (one-time per outlet)
- Committed: Yes

**`client/cms/public/diagram/`**
- Purpose: Architecture diagram images for documentation
- Committed: Yes

**`client/shared/`**
- Purpose: Intended for shared types between main and cms
- Current state: Empty — no shared code exists yet

---

*Structure analysis: 2026-04-24*
