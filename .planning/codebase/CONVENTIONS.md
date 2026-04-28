# Coding Conventions

**Analysis Date:** 2026-04-28

## Project Split: Two Styling Systems

This codebase contains two Next.js clients with fundamentally different styling approaches. Conventions differ per app — always check which app you're in before writing styles.

| App | Styling | Port |
|-----|---------|------|
| `client/cms/` | CSS variables + inline `style={{}}` props | 3001 |
| `client/main/` | Tailwind CSS utility classes | 3000 |
| `server/` | TypeScript, no styles | — |

---

## Naming Patterns

**Files:**
- React components: PascalCase — `FeedbackForm.tsx`, `SummaryCard`, `DateInput`
- Page files: always `page.tsx` (Next.js App Router convention)
- Hooks: camelCase prefixed with `use` — `useDeviceFingerprint.ts`, `useCustomer.ts`, `useOutlet.ts`
- Utilities/libs: camelCase — `api.ts`, `fingerprint.ts`, `validators.ts`, `paginate.ts`
- Server route files: camelCase matching resource — `visits.ts`, `customers.ts`, `outlets.ts`
- Server service files: PascalCase class name — `QRService.ts`, `SentimentService.ts`, `BaseService.ts`

**React Components:**
- Default exports for pages and primary components
- Named exports for context providers and hooks — `export function AuthProvider`, `export function useAuth`
- PascalCase function names always — `function StarBar(...)`, `function SummaryCard(...)`

**Variables:**
- camelCase throughout: `outletId`, `visitedAt`, `totalCustomers`, `isOwnerOrAbove`
- Short loop variables in tight JSX maps: `v` for visit, `o` for outlet, `os` for outlet stats
- Boolean flags prefixed with `is` or `has`: `isAdmin`, `isOwner`, `hasFilters`, `hasSubmittedFirstReview`

**TypeScript Types and Interfaces:**
- PascalCase interface names: `OutletStats`, `Visit`, `VisitSummary`, `PageResponse<T>`
- Zod schema names: camelCase with `Schema` suffix — `firstVisitFormSchema`, `ongoingReviewSchema`, `loginSchema`
- Inferred Zod types: `z.infer<typeof schema>` pattern, exported with PascalCase — `FirstVisitFormData`, `LoginFormData`
- Role types as union literals: `'admin' | 'owner' | 'franchise_owner'`

**Server-side:**
- Prisma models: PascalCase matching schema — `CustomerVisit`, `Customer`, `Staff`
- Router instances: `const router = Router()` (no suffix)
- Middleware functions: camelCase verbs — `requireAuth`, `requireAdmin`, `requireOwnerOrAbove`

---

## Styling: CMS (`client/cms/`)

The CMS uses **CSS variables defined in `client/cms/src/styles/globals.css`** applied via inline `style={{}}` props. Do not introduce Tailwind utility classes for layout or color in CMS pages.

**Design token variables (all defined in `:root`):**

```css
/* Colors */
--color-primary:        #F26522
--color-primary-hover:  #e05515
--color-primary-dim:    rgba(242, 101, 34, 0.12)
--color-primary-border: rgba(242, 101, 34, 0.25)

/* Surfaces */
--color-bg:       #0a0a0a
--color-surface:  #111111
--color-surface-2:#181818
--color-surface-3:#222222

/* Borders */
--color-border:        rgba(255, 255, 255, 0.07)
--color-border-strong: rgba(255, 255, 255, 0.12)

/* Text */
--color-text-1: #ffffff
--color-text-2: rgba(255, 255, 255, 0.6)
--color-text-3: rgba(255, 255, 255, 0.35)

/* Semantic */
--color-success: #22c55e
--color-warning: #f59e0b
--color-danger:  #ef4444
--color-info:    #3b82f6

/* Radii */
--radius-sm: 6px
--radius-md: 10px
--radius-lg: 16px
--radius-xl: 20px
```

**CMS utility CSS classes** (defined in globals.css, used via `className`):
- Layout: `.page-header`, `.page-content`, `.page-title`, `.page-subtitle`
- Cards: `.card`, `.stat-card`, `.stat-label`, `.stat-value`, `.stat-delta`
- Tables: `.data-table-wrap`, `.data-table`
- Inputs: `.input`
- Buttons: `.btn-primary`, `.btn-ghost`
- States: `.empty-state`, `.empty-state-icon`, `.empty-state-title`, `.empty-state-desc`
- Navigation: `.sidebar-link`, `.sidebar-link.active`, `.bottom-nav-item`

**CMS inline style pattern:**
```tsx
// Correct: CSS var references in inline style
<div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>

// Correct: semantic colors inline
<span style={{ color: 'var(--color-success)' }}>+{count}</span>

// Wrong: hardcoded hex in CMS pages
<div style={{ background: '#111111' }}>  // use var(--color-surface) instead
```

---

## Styling: Main App (`client/main/`)

The customer-facing app uses **Tailwind CSS utility classes exclusively**. No inline `style={{}}` for layout or color except for special cases (CSS `colorScheme` for date inputs, Framer Motion inline transforms).

**Brand colors via Tailwind config (`client/main/tailwind.config.ts`):**
- Primary orange: `bg-[#E88C3A]`, `text-[#E88C3A]`, gradient: `from-[#F2A65A] via-[#E88C3A] to-[#D96A1D]`
- Dark surfaces: `bg-[#111111]`, `bg-[#1A1A1A]`, `bg-[#000000]`
- Text opacity: `text-white/70`, `text-white/50`, `text-white/30`

**Main app reusable style strings (local constants in component files):**
```tsx
const inputStyles = "w-full bg-[#1A1A1A] border border-white/10 rounded-[12px] px-4 py-3 text-[14px] text-white placeholder-white/20 focus:outline-none focus:border-[#E88C3A] focus:ring-1 focus:ring-[#E88C3A]/50 transition-all shadow-inner"
const labelStyles = "block text-[13px] font-medium text-white/70 mb-1.5 ml-1"
const errorStyles = "mt-1 ml-1 text-[12px] text-red-400"
```
Define these as `const` strings at the top of the component file, not as separate CSS classes.

**Motion animations (Framer Motion):**
- All animated elements use `<motion.div>` or `<motion.button>` with `whileHover`, `whileTap`, `initial`, `animate`, `transition`
- Standard easing: `ease: [0.4, 0, 0.2, 1]` (CSS ease-in-out cubic-bezier)
- Standard entrance: `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`
- Staggered entrances use `transition: { delay: 0.25 }`, `{ delay: 0.30 }`, etc.

---

## Component Structure

**CMS page pattern (all CMS pages under `client/cms/src/app/(cms)/`):**
1. `'use client'` directive at top
2. Sub-components defined as small named functions in the same file (before default export)
3. Custom hooks defined in the same file if page-specific (e.g., `useDebounce`)
4. Page component is the default export at the bottom
5. Data fetching in `useEffect` inside the page component using `api.get()`
6. All state in the page component, passed as props to sub-components
7. Section dividers with `// ─── Section Name ──────` ASCII separator comments

```tsx
// CMS page structure template:
'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { SomeType } from '@/types/api'

// ─── Sub-Component ────────────────────────────────────────────────────────────
function SubComponent({ prop }: { prop: string }) {
  return <div style={{ color: 'var(--color-text-1)' }}>{prop}</div>
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SomePage() {
  const { user, isOwnerOrAbove } = useAuth()
  const [data, setData] = useState<SomeType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<SomeType[]>('/cms/something')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return <div>...</div>
}
```

**Main app component pattern (`client/main/`):**
- Hooks extracted to `client/main/src/hooks/` — `useDeviceFingerprint`, `useCustomer`, `useOutlet`
- Forms use `react-hook-form` + `zodResolver` + Zod schema from `client/main/src/lib/validators.ts`
- Framer Motion wraps interactive elements
- Props interfaces defined inline above component: `interface Props { outlet: Outlet; deviceId: string; onSuccess: () => void }`

---

## Import Organization

**Order (consistent across all files):**
1. React and Next.js imports (`react`, `next/navigation`, `next/link`)
2. Third-party libraries (`axios`, `framer-motion`, `date-fns`, `react-hook-form`)
3. Internal path-aliased imports (`@/lib/api`, `@/context/AuthContext`, `@/types/api`)
4. Type-only imports last with `import type { ... }`

**Path aliases:**
- Both Next.js clients use `@/` mapping to `src/` (configured in `tsconfig.json`)
- Server uses relative imports only (`../lib/prisma`, `../../middleware/auth`)

---

## Error Handling

**API calls in React (CMS):**
```tsx
// Standard pattern: catch -> console.error, finally -> setLoading(false)
api.get<T>('/cms/route')
  .then(res => setState(res.data))
  .catch(console.error)
  .finally(() => setLoading(false))

// For parallel calls:
Promise.all([api.get(...), api.get(...)])
  .then(([res1, res2]) => { ... })
  .catch(console.error)
  .finally(() => setLoading(false))
```

**API calls in React (main app forms):**
```tsx
// Standard pattern: try/catch with toast.error
try {
  const res = await api.post('/customers', data)
  // handle success
} catch (err: any) {
  toast.error(err.response?.data?.message || 'Submission failed. Please try again.')
} finally {
  setSubmitting(false)
}
```

**Server route handlers:**
```ts
// Standard pattern: try/catch with next(err), Zod parse at entry point
router.post('/', async (req, res, next) => {
  try {
    const body = CreateVisitSchema.parse(req.body)
    // ... logic
    res.status(201).json(result)
  } catch (err) {
    next(err)  // always pass to errorHandler middleware
  }
})
```

**Server Zod validation:**
- Parse at the top of route handlers using `Schema.parse(req.body)` — Zod throws `ZodError` on invalid input, which `errorHandler` middleware catches and formats as 400.

---

## TypeScript Patterns

**Server route files use `where: any` for Prisma dynamic filters:**
```ts
const where: any = {}
if (outletId) where.outletId = outletId
```
This is an accepted pattern throughout CMS route files — not ideal, but consistent.

**Nullish coalescing and optional chaining are used throughout:**
```ts
os.averageRating?.toFixed(1) ?? '—'
req.staff!.assignedOutletId ?? undefined
```

**Non-null assertion (`!`) on `req.staff`** after `requireAuth` middleware — safe because middleware guarantees the field.

---

## Server Route Conventions

**Route file structure (`server/src/routes/`):**
- Public routes: `server/src/routes/*.ts` (no auth)
- CMS protected routes: `server/src/routes/cms/*.ts` (all prefixed with `router.use(requireAuth)`)
- Each route file exports `default router`
- Registered in `server/src/app.ts` with clear namespace prefixes (`/api/cms/...`)

**Role enforcement in route handlers:**
```ts
// Inline role-scope filtering (franchise_owner sees only assigned outlet):
let outletId: string | undefined
if (req.staff!.role === 'franchise_owner') {
  outletId = req.staff!.assignedOutletId ?? undefined
} else if (req.query.outletId) {
  outletId = req.query.outletId as string
}
```

**Pagination:** Always use `paginate()` from `server/src/lib/paginate.ts` for list endpoints — returns `{ content, totalElements, totalPages, size, number, first, last }`.

---

## Logging

- Server: `console.error('[CORS Error] ...')` for infrastructure errors only
- Client hooks: `console.error('[hookName]', err.message)` for unexpected errors
- Expected 404s (e.g., new device with no customer record) are silently handled, not logged
- No structured logging library — plain `console.error`

---

## Comments

**ASCII section dividers** are used consistently in multi-section files:
```ts
// ─── Section Name ─────────────────────────────────────────────────────────────
```

**Inline context comments** for non-obvious business logic:
```ts
// Dedup: one visit per device per outlet per hour
// For visits where customerId is null, look up customer by deviceId
```

**JSDoc:** Used sparingly — only on `QRService` methods. Not a requirement for most code.

---

## Form Conventions (both apps)

- Always use `react-hook-form` with `zodResolver`
- Schema defined in `validators.ts` (main app) or inline (CMS pages)
- `register`, `handleSubmit`, `watch`, `setValue`, `formState: { errors }` destructured from `useForm`
- Submit handler is `async`, named `onSubmit`, receives typed form data
- Loading state controlled by `setSubmitting(true/false)` around async operations

---

*Convention analysis: 2026-04-28*
