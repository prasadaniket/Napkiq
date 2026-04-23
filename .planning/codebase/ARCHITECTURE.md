# Architecture

**Analysis Date:** 2026-04-24

## Pattern Overview

**Overall:** Three-tier monorepo — public customer frontend, CMS admin frontend, REST API backend. No shared runtime between the three apps; they communicate over HTTP only.

**Key Characteristics:**
- Public customer journey is stateless from the server's perspective (device fingerprint is the only identity anchor before registration)
- CMS is a fully authenticated SPA-style Next.js app with role-scoped API access
- The API enforces all authorization server-side; the UI only hides/shows UI elements, never gates data
- Automation runs as a scheduled external trigger (Cloudflare Worker cron) calling a dedicated API endpoint via a shared secret

---

## Application Tiers

### 1. Public Customer Frontend
- Location: `client/main/`
- URL: `stoneoven.in`
- Framework: Next.js (App Router), client components only for interactive pages
- Purpose: QR scan landing → customer registration form → review/feedback submission → menu browsing

### 2. CMS Admin Frontend
- Location: `client/cms/`
- URL: `stoneoven.in/cms`
- Framework: Next.js (App Router), all pages under `(cms)` route group
- Purpose: Staff portal — dashboards, customer management, reviews, visits, menu editing, automation logs

### 3. REST API
- Location: `server/`
- URL: `api.stoneoven.in`, port 8080
- Framework: Express 5, TypeScript
- Purpose: Single API for both frontends — public unauthenticated routes + protected CMS routes + automation endpoint

---

## Server Layer Design

### Entry Points
- `server/src/index.ts` — bootstraps Express app, overrides DNS to Google servers (resolves Supabase connectivity issue on host), listens on `$PORT` (default 8080)
- `server/src/app.ts` — `createApp()` factory: CORS config from `CORS_ORIGINS` env var, JSON middleware, route mounting, error handler

### Route Namespaces

**Public (no auth):**
```
GET/POST  /api/outlets          — list outlets, get by slug or code
GET/POST  /api/customers        — device lookup + upsert registration
POST      /api/visits           — record a visit (qr_scan or payment)
POST      /api/reviews          — submit a star rating + text
GET       /api/menu             — public menu for outlet (categories + items)
```

**Auth:**
```
POST  /api/auth/login     — username → Supabase email lookup → signInWithPassword
POST  /api/auth/refresh   — exchange refresh token for new JWT
GET   /api/auth/me        — session restoration (requireAuth)
```

**CMS (all require `requireAuth`):**
```
GET       /api/cms/dashboard/stats         — aggregate stats, role-scoped
GET       /api/cms/customers               — paginated list with filters
GET       /api/cms/customers/:id           — full profile + visits + reviews
GET       /api/cms/reviews                 — paginated list with filters
GET       /api/cms/outlets                 — list outlets, role-scoped
GET       /api/cms/outlets/stats           — per-outlet performance cards
GET       /api/cms/outlets/:id             — single outlet full analytics
GET       /api/cms/visits                  — paginated list with filters
GET       /api/cms/visits/summary          — qr_scan vs payment breakdown
GET       /api/cms/automation-logs         — paginated automation log history
GET       /api/cms/export/customers        — CSV download (admin only)
GET       /api/cms/export/visits           — CSV download (admin only)
GET/POST/PUT/DELETE  /api/cms/menu         — menu categories and items (admin only)
POST      /api/cms/menu/items/:id/image    — Cloudinary upload (admin only)
DELETE    /api/cms/menu/items/:id/image    — Cloudinary delete (admin only)
```

**Automation (dual-auth):**
```
POST  /api/automation/run           — x-automation-secret header only (Cloudflare Worker daily cron)
POST  /api/automation/reengagement  — x-automation-secret OR JWT admin (manual CMS trigger)
```

---

## Authentication & RBAC

### Login Flow
```
CMS Login Page
  → POST /api/auth/login { username, password }
  → Server: prisma.staff.findUnique({ username }) → get email
  → Server: supabaseAdmin.auth.signInWithPassword({ email, password })
  → Returns: { token (JWT), refreshToken, role, assignedOutletId, ... }
  → Client: saves to cookies (cms_token, cms_refresh_token, cms_user) via client/cms/src/lib/auth.ts
```

### Request Auth Flow
```
CMS Page
  → client/cms/src/lib/api.ts interceptor attaches Bearer token from cookie
  → Express requireAuth middleware (server/src/middleware/auth.ts):
      1. Extracts token from Authorization header
      2. supabaseAdmin.auth.getUser(token) — validates JWT with Supabase
      3. prisma.staff.findUnique({ id: user.id }) — loads role + outlet assignment
      4. Maps main_owner → admin (backward compat, main_owner is @deprecated)
      5. Attaches req.staff = { id, fullName, email, role, assignedOutletId }
  → Route handler reads req.staff for RBAC decisions
```

### Token Refresh
```
client/cms/src/lib/api.ts interceptor catches 401 responses
  → calls POST /api/auth/refresh with stored refresh token
  → on success: saves new tokens, retries original request
  → on failure: clearSession() + redirect to /login
  (concurrent 401s are queued and flushed after a single refresh)
```

### Role Hierarchy

| Role | DB Value | Access Scope |
|------|----------|--------------|
| `admin` | `admin` (or legacy `main_owner`) | Full CMS, automation trigger, CSV export, menu management |
| `owner` | `owner` | All outlets — dashboard, customers, reviews, visits. No automation, no export, no menu edit |
| `franchise_owner` | `franchise_owner` | Single outlet only — locked to `assignedOutletId` at API level, query params for outlet ignored |

### RBAC Enforcement Pattern

**Route-level guards** (applied as middleware in `server/src/middleware/auth.ts`):
- `requireAdmin` — rejects non-admin with 403
- `requireOwnerOrAbove` — rejects franchise_owner with 403
- `requireAuth` — baseline for all CMS routes

**Data-level scoping** (inside route handlers, same pattern across cms routes):
```typescript
// franchise_owner is ALWAYS locked to assignedOutletId — query param is ignored
function resolveOutletFilter(req): string | null {
  if (req.staff.role === 'franchise_owner') {
    return req.staff.assignedOutletId  // ignores ?outletId query param
  }
  return (req.query.outletId as string) || null
}
```

This `resolveOutletFilter` pattern appears in:
- `server/src/routes/cms/customers.ts`
- `server/src/routes/cms/visits.ts`
- `server/src/routes/cms/dashboard.ts`
- `server/src/routes/cms/outlets.ts`

The API-level scope is the canonical authorization gate. Frontend role checks (`isAdmin`, `isFranchise`) are UI convenience only and must not be relied on for security.

---

## Customer Journey Data Flow

### QR Scan → Landing Page

```
Customer scans QR code at outlet table
  → navigates to stoneoven.in/outlet/[code]  (e.g. /outlet/boisar)
  → Page load (client/main/src/app/outlet/[code]/page.tsx):
      1. useDeviceFingerprint() — FingerprintJS.load() → stable visitorId
      2. useOutlet(code) → GET /api/outlets/[code]  (resolved by slug or code)
      3. useCustomer(deviceId) → GET /api/customers/by-device/[deviceId]
      4. POST /api/visits { deviceId, outletId, visitType: 'qr_scan' }  (fires once on mount)
  → Shows: View Menu, Get Directions, Your First Visit, Share Your Experience buttons
```

### First Visit Registration

```
/outlet/[code]/feedback
  → client/main/src/components/form1/feedback.tsx collects:
      fullName, phone, email (optional), birthDate, anniversaryDate (optional),
      gender, maritalStatus
  → POST /api/customers { deviceId, fullName, phone, ..., firstVisitOutletId }
      - Upsert on deviceId: creates new or updates existing record
      - Phone conflict (Prisma P2002): links deviceId to existing customer by phone
  → POST /api/reviews { customerId, outletId, stars, reviewType: 'first_visit' }
      - Sets customer.hasSubmittedFirstReview = true
  → Redirects to /outlet/[code] after 2s success screen
```

### Repeat Review

```
/outlet/[code]/review
  → client/main/src/components/form2/review.tsx
  → customer already loaded via useCustomer (deviceId)
  → POST /api/reviews { customerId, outletId, stars, reviewText, reviewType: 'repeat' }
  → Redirects to /outlet/[code] after 2s success screen
```

---

## Automation System

### Architecture

```
Cloudflare Worker (daily cron)
  → POST https://api.stoneoven.in/api/automation/run
  → Header: x-automation-secret: <AUTOMATION_SECRET>
  → server/src/routes/automation.ts: runAutomation()
      Loads all customers with email set
      For each customer:
        Birthday stages: five_days_before, one_day_before, on_day
        Anniversary stages: five_days_before, one_day_before, on_day
        Re-engagement: lastVisitDate >= 30 days ago → thirty_days_inactive
      Each message attempt:
        1. alreadySent() check against AutomationLog (today's records only)
        2. sendWhatsApp() or sendEmail() from server/src/lib/notifications.ts
        3. logSend() → creates AutomationLog record regardless of success/fail

CMS Admin manual trigger (re-engagement only)
  → POST /api/automation/reengagement
  → JWT Bearer token (requireAuth + requireAdmin) OR x-automation-secret
  → Targets only 30d+ inactive customers
```

### Notification Status (as of 2026-04-24)
- **DRY_RUN mode active** when `TWILIO_ACCOUNT_SID` or `RESEND_API_KEY` not set in env
- `sendWhatsApp()` — Twilio stub in `server/src/lib/notifications.ts` (commented out, awaiting Meta template approval)
- `sendEmail()` — Resend stub in `server/src/lib/notifications.ts` (commented out)
- AutomationLogs populate correctly in DRY_RUN mode; CMS Automation page reads these logs

### Deduplication Guard
```typescript
// server/src/routes/automation.ts
// Prevents re-sending to same customer on the same calendar day
const existing = await prisma.automationLog.findFirst({
  where: {
    customerId,
    automationType: automationType as any,
    messageStage: stage as any,
    sentAt: { gte: today, lt: tomorrow },
  },
})
return existing !== null  // returns true = skip
```

---

## Menu System

- Menu data is per-outlet (`MenuCategory.outletId`) — null outletId means global/shared category
- Items support `priceVariants: Json?` for multi-size pricing alongside flat `price: Decimal?`
- Images stored on Cloudinary under `StoneOven/menu/` folder, public_id format: `item_{uuid}`
- CRUD is admin-only via `server/src/routes/cms/menu.ts`
- Public read via `server/src/routes/menu.ts`
- Image upload: multipart/form-data, multer memory storage (5MB limit) → Cloudinary upload_stream with auto quality/format transformation (800x800 limit)
- Delete: soft-deletes categories (sets `isActive: false`), hard-deletes items + removes Cloudinary asset

---

## CMS Frontend Architecture

### Auth State
- `client/cms/src/context/AuthContext.tsx` — React context wrapping `LoginResponse`
- Role helpers: `isAdmin`, `isOwner`, `isFranchise`, `isOwnerOrAbove`
- Session stored in browser cookies (not localStorage) — survives page refresh, accessible to Next.js middleware

### API Client
- `client/cms/src/lib/api.ts` — Axios instance with `baseURL = NEXT_PUBLIC_API_URL`
- Request interceptor: attaches `Bearer` token from `cms_token` cookie
- Response interceptor: 401 triggers single token refresh attempt, then redirect to `/login`
- Concurrent 401s are queued and resolved after the refresh completes

### CMS Page Auth Pattern
Individual pages call `useAuth()` and redirect unauthorized roles:
```typescript
const { isOwnerOrAbove } = useAuth()
useEffect(() => {
  if (!isOwnerOrAbove) router.replace('/dashboard')
}, [isOwnerOrAbove])
```

---

## Error Handling

**API global handler:** `server/src/middleware/errorHandler.ts` — logs `err.message + stack`, returns `{ error: message }` with HTTP 500.

**Route validation:** `zod` schemas validate request bodies in public routes (`CreateCustomerSchema`, `CreateVisitSchema`, `CreateReviewSchema`). Parse errors propagate to the global error handler.

**Prisma P2002 (unique constraint) handling:** `server/src/routes/customers.ts` catches phone-already-registered conflicts and silently re-links `deviceId` to the existing customer.

**Client error handling:** Axios interceptors handle 401 globally. CMS pages use local `useState` error flags with skeleton/empty-state UI.

---

## Database Access Pattern

- Single Prisma client singleton: `server/src/lib/prisma.ts`
- All queries via Prisma ORM — no raw SQL
- Pagination utility: `server/src/lib/paginate.ts` → `{ content, totalElements, totalPages, size, number, first, last }`
- CMS list endpoints: `page` (0-indexed) + `size` (capped at 100) query params
- Dashboard stats use `Promise.all()` for parallel Prisma queries to minimize latency

---

*Architecture analysis: 2026-04-24*
