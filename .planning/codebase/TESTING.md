# Testing Patterns

**Analysis Date:** 2026-04-24

## Test Framework

**Runner:** None installed.

No test runner (`jest`, `vitest`, `mocha`, `playwright`, `cypress`) appears in any `package.json` — not in `client/cms/package.json`, `client/main/package.json`, or `server/package.json`.

No `jest.config.*`, `vitest.config.*`, or `playwright.config.*` files exist anywhere in the project tree.

No `*.test.*` or `*.spec.*` files exist outside of `node_modules`.

**Run Commands:**
```bash
# No test script exists in any package.json
# The only quality scripts available are:
cd client/cms  && npm run lint   # next lint (Next.js default rules)
cd client/main && npm run lint   # next lint (Next.js default rules)
# server has no lint script
```

## Current Test Coverage

**Zero.** There are no automated tests of any kind in this project — no unit tests, no integration tests, no end-to-end tests.

## What Is Not Tested

Everything. Specifically, the following areas have no test coverage:

**Server — business logic:**
- RBAC scoping in every CMS route (`server/src/routes/cms/`)
- `requireAuth`, `requireAdmin`, `requireOwnerOrAbove` middleware (`server/src/middleware/auth.ts`)
- `paginate()` utility (`server/src/lib/paginate.ts`)
- Date helper functions `daysAgo()`, `startOf()`, `monthRange()` in `server/src/routes/cms/dashboard.ts`
- Automation trigger logic and notification dispatch (`server/src/routes/automation.ts`, `server/src/lib/notifications.ts`)

**Server — API contracts:**
- No contract or integration tests for any endpoint under `/api/cms/*` or `/api/*`
- No validation that `Promise.all` queries return correct data under edge conditions (empty outlets, no visits, etc.)

**Client — components:**
- `ReviewCard` (`client/cms/src/components/cms/ReviewCard.tsx`)
- All inline sub-components: `StatCard`, `SummaryCard`, `Initials`, `StarBar`
- `AuthContext` / `useAuth` hook (`client/cms/src/context/AuthContext.tsx`)

**Client — pages:**
- Dashboard stats rendering and role-based visibility
- Filter state and `buildQuery` logic (visits, customers, reviews pages)
- Pagination controls

**Client — hooks:**
- `useOutlet` (`client/main/src/hooks/useOutlet.ts`)
- `useCustomer`, `useAuth`, `useDeviceFingerprint` (`client/main/src/hooks/`)
- Inline `useDebounce` (duplicated in visits and customers pages)

**Client — API layer:**
- Token refresh queue logic in `client/cms/src/lib/api.ts`
- 401 intercept and redirect behavior

## Risk Areas Without Tests

**High risk:**
- `server/src/routes/cms/dashboard.ts` — 13-query `Promise.all` with date arithmetic; a bug in `daysAgo()` or `startOf()` would silently return wrong stats to all users
- `server/src/middleware/auth.ts` — RBAC middleware; a regression would expose all-outlet data to franchise owners
- `server/src/routes/automation.ts` — triggers live WhatsApp/email sends; no test guard against double-firing

**Medium risk:**
- `client/cms/src/lib/api.ts` token refresh queue — concurrent 401s could cause race conditions or redirect loops
- Filter query construction in visits/customers pages — URL params built from multiple state variables; easy to introduce a regression silently

## If Tests Were Added

**Recommended stack for this project:**

Server:
- `vitest` or `jest` with `supertest` for route integration tests
- Test files co-located: `server/src/routes/cms/dashboard.test.ts`

Client:
- `vitest` + `@testing-library/react` for component/hook tests
- Test files co-located: `client/cms/src/app/(cms)/dashboard/page.test.tsx`

**Highest-value first tests to write:**
1. `server/src/lib/paginate.ts` — pure function, trivial to test
2. `server/src/middleware/auth.ts` `requireAuth` / `requireAdmin` guards — mock Supabase + Prisma
3. `server/src/routes/cms/dashboard.ts` date helper functions — pure functions, no DB needed
4. `client/cms/src/context/AuthContext.tsx` role flags — render with mock user, assert booleans

---

*Testing analysis: 2026-04-24*
