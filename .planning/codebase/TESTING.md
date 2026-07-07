# Testing Patterns

**Analysis Date:** 2026-07-07

## Current State: No Tests Exist

There are still zero test files, no test runner, and no test libraries across `client/cms/`, `client/main/`, and `server/`. No `jest.config.*` / `vitest.config.*` is present.

```bash
# Confirmed: no test files
find . -name "*.test.*" -o -name "*.spec.*"  # returns nothing
```

---

## What Needs Testing (Priority Order)

### High Priority — Business-Critical Logic

**Server: Order creation (`server/src/lib/orders.ts`)** — the highest-value new surface:
- Prices/names are snapshotted server-side — a test must confirm a client-supplied price is ignored
- Variant-priced items resolve the chosen `variantLabel`'s price; an invalid/missing variant is rejected
- Items not on the outlet's menu are rejected (`OrderValidationError`)
- `nextDailyNumber` allocates sequential per-outlet tokens and resets across IST business days; must be race-safe under concurrent creates (the `INSERT … ON CONFLICT` guarantees this — test with parallel calls)

**Server: Order routes (`server/src/routes/orders.ts`, `routes/cms/orders.ts`):**
- Customer self-cancel allowed only when `status = new` and only from the placing `deviceId` (403/409 otherwise)
- KDS `GET /cms/orders/stream` rejects missing/invalid `?token=`; `franchise_owner` is pinned to their outlet; admin/owner require `?outletId`
- Status transitions emit `orderEvents` and set `closedAt`/`cancelledBy` on terminal states

**Server: Visit deduplication (`server/src/routes/visits.ts`)** — one visit per device per outlet per hour.

**Server: Role-scoped data filtering (`routes/cms/*`)** — `franchise_owner` never sees other outlets' data.

**Server: Pagination utility (`server/src/lib/paginate.ts`)** — pure function; edge cases.

**Client: Zod validators (`client/main/src/lib/validators.ts`)** — pure schemas (e.g. married + no anniversary should fail; phone regex `^[6-9]\d{9}$`).

### Medium Priority — Integration Points

**Server: Auth (`server/src/middleware/auth.ts`)** — missing header → 401; invalid token → 401; inactive staff → 401; `main_owner` maps to `admin`; `resolveStaffFromToken` shared by header and SSE query-param paths.

**Server: Rate limiters (`server/src/middleware/rateLimit.ts`)** — limiter fires after the configured `max` within the window (429 JSON body).

**Client hooks:** `useCustomer` (404 does not set error), `useDeviceFingerprint` (resolves `deviceId`, loading toggles).

### Lower Priority — UI

CMS filter/debounce/pagination; KDS SSE reconnect behaviour; main-app cart + order tracking; star rating and conditional anniversary field.

---

## Recommended Test Stack (Not Yet Installed)

**Server:**
```bash
npm install -D jest @types/jest ts-jest supertest @types/supertest
```
Use `supertest` for Express routes; mock `prisma` and `supabaseAdmin` with `jest.mock()`. For SSE endpoints, assert the `text/event-stream` response and that `emitOrderEvent` pushes a `data:` frame.

**Clients:**
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom
```
Use `@testing-library/react`; mock `@/lib/api` with `vi.mock()`.

---

## Test File Placement

Co-locate tests with source (`paginate.ts` + `paginate.test.ts`, `orders.ts` + `orders.test.ts`, `validators.ts` + `validators.test.ts`, etc.).

---

## Mock Strategy

- **Prisma:** always mock at the module level (`jest.mock('../../lib/prisma')`) — never hit a real DB. For order tests, mock `prisma.$queryRaw` to return an incrementing `last_number`.
- **Supabase:** mock `supabaseAdmin.auth.getUser`.
- **orderEvents:** spy on `emitOrderEvent`, or subscribe via `onOrderEvent` and assert the emitted payload.
- **Axios (client):** `vi.mock('@/lib/api')`.
- **FingerprintJS:** mock `getDeviceFingerprint` to a fixed string.

---

## Coverage Goals (When Tests Are Added)

- `server/src/lib/` (paginate, orders): 90%+
- `server/src/middleware/`: 90%+
- `server/src/routes/orders.ts` + `routes/visits.ts`: 90%+
- `server/src/routes/cms/` role-enforcement paths: 80%+
- `client/main/src/lib/validators.ts`: 100%

---

*Testing analysis: 2026-07-07*
