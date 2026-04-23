# Coding Conventions

**Analysis Date:** 2026-04-24

## TypeScript Strictness

All three sub-projects run `"strict": true`.

| Sub-project | Config | Target | Module |
|---|---|---|---|
| `client/cms` | `client/cms/tsconfig.json` | ES2017 | ESNext / bundler |
| `client/main` | `client/main/tsconfig.json` | ES2017 | ESNext / bundler |
| `server` | `server/tsconfig.json` | ES2020 | CommonJS |

Both Next.js clients use identical tsconfig. The server additionally sets `forceConsistentCasingInFileNames: true` and emits declarations + source maps (`declaration`, `declarationMap`, `sourceMap`).

**Path alias:** All three use `@/*` mapping to `./src/*`. Use `@/` imports everywhere — never use relative `../../` chains.

**Known looseness:** `where: any` appears in several server route filter objects (`server/src/routes/cms/visits.ts`, `server/src/routes/cms/reviews.ts`). This is a pragmatic workaround for dynamic Prisma `where` construction — keep it contained to the `where` variable only. The `automation.ts` route also uses `as any` casts for Prisma enum fields.

## Linting

No project-level `.eslintrc` or `eslint.config.*` files exist. All three packages list `eslint` + `eslint-config-next` in devDependencies and expose a `lint` script (`next lint`). ESLint runs with Next.js defaults only (no custom rules file). The server has no lint script at all.

**Practical implication:** There is no enforced lint gate on the server. Client lint is limited to what `eslint-config-next` provides out of the box.

## Naming Patterns

**Files:**
- Next.js pages: `page.tsx` (lowercase, App Router convention) inside named route directories
- Route directories: lowercase kebab-case matching URL segment — `(cms)/customers/`, `(cms)/visits/`, `outlet/[code]/`
- Server route files: lowercase camelCase matching the resource — `customers.ts`, `automationLogs.ts`
- CMS sub-routes nested under `server/src/routes/cms/`
- Components: PascalCase files — `ReviewCard.tsx`, `AuthContext.tsx`
- Hooks: camelCase with `use` prefix — `useAuth.ts`, `useOutlet.ts`, `useCustomer.ts`
- Lib/util files: camelCase — `api.ts`, `paginate.ts`, `cloudinary.ts`

**Functions and variables:**
- React components: PascalCase (`StatCard`, `SummaryCard`, `Initials`, `StarBar`)
- Hooks: camelCase with `use` prefix (`useAuth`, `useDebounce`, `useOutlet`)
- Server route handlers: anonymous `async (req, res, next) =>` — no named function per handler
- Utility/helper functions on server: camelCase (`daysAgo`, `startOf`, `monthRange`, `paginate`)
- Boolean state flags: `loading`, `error`; role helpers prefixed `is*` (`isAdmin`, `isOwner`, `isFranchise`, `isOwnerOrAbove`)

**Types and interfaces:**
- Interfaces use PascalCase with no `I` prefix — `Customer`, `Visit`, `Review`, `PageResponse<T>`, `StaffPayload`
- Enums expressed as TypeScript union string literals — `'admin' | 'owner' | 'franchise_owner'`
- API response shape types live in `client/cms/src/types/api.ts` and `client/main/src/types/`
- Server augments Express `Request` via `declare global { namespace Express { interface Request { staff?: StaffPayload } } }` in `server/src/middleware/auth.ts`

## Import Organization

**Observed order (client):**
1. React / Next.js framework imports (`'react'`, `'next/link'`, `'next/navigation'`)
2. Internal `@/` path alias imports (`@/lib/api`, `@/context/AuthContext`, `@/hooks/useAuth`)
3. Third-party utility imports (`date-fns`, `react-hot-toast`)
4. Type-only imports last, using `import type` keyword (`@/types/api`)

**Observed order (server):**
1. Framework / Node imports (`express`, `cors`, `dotenv/config`)
2. Internal relative imports (`../../lib/prisma`, `../../middleware/auth`)
3. No type-only import convention enforced

Always use `@/` for intra-project imports — relative paths are not used in application code.

## Component Patterns

**Inline sub-components inside page files:**
Small display-only components used only by one page are declared at the top of that page file as plain (non-exported) functions. Examples:
- `StatCard` in `client/cms/src/app/(cms)/dashboard/page.tsx`
- `Initials` in `client/cms/src/app/(cms)/visits/page.tsx` and `customers/page.tsx`
- `SummaryCard` in `client/cms/src/app/(cms)/visits/page.tsx`
- `StarBar` in `client/cms/src/app/(cms)/outlets/page.tsx`

**Separate component files** are used only when a component is reused across multiple pages. Currently, `client/cms/src/components/cms/ReviewCard.tsx` is the only shared CMS component.

**Rule:** If a component appears only in one page, define it inline at the top of that page file. Extract to `src/components/` only when reused.

## Styling — CMS (client/cms)

**No CSS modules.** All component-level styling uses inline `style={{}}` props referencing CSS custom properties.

Design tokens are defined in `client/cms/src/styles/globals.css`:
- Colors: `var(--color-primary)` (#F26522 orange), `var(--color-bg)`, `var(--color-surface)`, `var(--color-text-1/2/3)`, `var(--color-success/warning/danger/info)`
- Radii: `var(--radius-sm/md/lg/xl)`
- Sidebar: `var(--sidebar-width)` (220px), `var(--sidebar-bg)`

Semantic utility class names defined in globals.css (not Tailwind) are used for structural elements: `.page-header`, `.page-title`, `.page-subtitle`, `.page-content`, `.card`, `.stat-card`, `.stat-icon`, `.stat-label`, `.stat-value`, `.stat-delta`, `.input`, `.btn-primary`, `.btn-ghost`, `.data-table-wrap`, `.data-table`, `.empty-state`, `.role-badge`.

**Pattern:** Use the class name for structural wrapper, inline `style={{}}` for instance-specific sizing/spacing/color overrides.

**Loading skeleton animation:** The `@keyframes pulse` animation is injected as an inline `<style>` tag inside the JSX directly alongside the skeleton divs:
```tsx
<style>{`@keyframes pulse { 0%,100% { opacity: 0.5 } 50% { opacity: 1 } }`}</style>
```
This is repeated in several pages (dashboard, visits, outlets). It is intentional — there is no shared animation class.

## Server Route Structure

Every route file follows this exact shape:
```typescript
import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { requireAuth } from '../../middleware/auth'

const router = Router()
router.use(requireAuth)          // applied once at top, covers all routes in the file

router.get('/', async (req, res, next) => {
  try {
    // ... business logic
    res.json(result)
  } catch (err) {
    next(err)                    // always forward errors — never res.status(500) directly
  }
})

export default router
```

Section dividers use this comment style throughout server and client code:
```
// ─── Section Name ──────────────────────────────────────────────────────────────
```

## Parallel Queries Pattern

All routes that need multiple independent database counts or queries use `Promise.all([...])`. Destructured result variable names exactly match the data they hold:

```typescript
const [
  totalCustomers,
  totalReviews,
  avgStarsResult,
  inactiveCustomers,
] = await Promise.all([
  prisma.customer.count({ where: customerWhere }),
  prisma.review.count({ where: reviewWhere }),
  prisma.review.aggregate({ where: reviewWhere, _avg: { stars: true } }),
  prisma.customer.count({ where: { ...customerWhere, lastVisitDate: { lt: thirtyDaysAgo } } }),
])
```

This pattern appears in `server/src/routes/cms/dashboard.ts`, `server/src/routes/cms/outlets.ts`, `server/src/routes/cms/visits.ts`, and in client fetch callbacks in `client/cms/src/app/(cms)/visits/page.tsx`.

## Pagination

Routes returning lists use the `paginate()` helper from `server/src/lib/paginate.ts`. The returned shape matches the `PageResponse<T>` interface in `client/cms/src/types/api.ts`:
```
{ content, totalElements, totalPages, size, number, first, last }
```
Default page size: 20. Max page size: 100 (capped server-side).

## RBAC Scoping Pattern

Every CMS route reads `req.staff!.role` and `req.staff!.assignedOutletId` to scope queries. Franchise owners are always locked to their assigned outlet — enforced in route logic:
```typescript
if (req.staff!.role === 'franchise_owner') {
  outletId = req.staff!.assignedOutletId ?? undefined
} else if (req.query.outletId) {
  outletId = req.query.outletId as string
} else {
  // admin/owner — all outlets
}
```
The three roles are: `admin`, `owner`, `franchise_owner`. Middleware guards `requireAdmin`, `requireOwnerOrAbove` are in `server/src/middleware/auth.ts`.

## Client State Management Pattern

All CMS pages manage state with `useState` + `useEffect`. No Redux, Zustand, or other global state library. The only shared state is auth via `client/cms/src/context/AuthContext.tsx`.

Standard fetch pattern:
```typescript
const [data, setData]       = useState<T[]>([])
const [loading, setLoading] = useState(true)
const [error, setError]     = useState(false)

useEffect(() => {
  if (!user) return
  api.get<T>('/cms/...')
    .then(res => setData(res.data))
    .catch(() => setError(true))
    .finally(() => setLoading(false))
}, [user])
```

For pages with filters, `useCallback` wraps the fetch function and `buildQuery()` constructs `URLSearchParams`. Search debouncing is done with an inline `useDebounce<T>(value, delay)` generic hook defined at the top of the page file (not extracted to a shared hooks file — duplicated in `visits/page.tsx` and `customers/page.tsx`).

## Error Handling

**Server:**
- All route handlers wrap logic in `try/catch` and call `next(err)` — never `res.status(500)` directly
- `server/src/middleware/errorHandler.ts` responds `{ error: message }` and logs via `console.error`
- Auth failures return structured JSON: `{ error: 'Missing or invalid Authorization header' }`

**Client:**
- Network errors caught via `.catch()` on axios calls
- CMS pages set an `error` boolean flag and render an empty-state error block
- Mutations use `react-hot-toast` for success/failure feedback (`toast.success(...)`, `toast.error(...)`)
- No global React error boundary exists in either client

## `'use client'` Directive

All CMS page files and hook-using components begin with `'use client'` as the very first line before any imports. This includes all `page.tsx` files and `AuthContext.tsx`.

## Comments

JSDoc-style block comments appear on complex route handlers to document query params and scoping rules:
```typescript
/**
 * GET /api/cms/dashboard/stats
 *
 * Query params:
 *   ?outletId=uuid  — scope to a single outlet
 *
 * Scoping rules:
 *   admin / owner   — all outlets (or filtered by ?outletId)
 *   franchise_owner — always scoped to assignedOutletId
 */
```

Deprecated functions are annotated: `/** @deprecated use requireAdmin instead */`

---

*Convention analysis: 2026-04-24*
