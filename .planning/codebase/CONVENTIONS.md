# Coding Conventions

**Analysis Date:** 2026-07-07

## Project Split: Two Styling Systems

Two Next.js clients with fundamentally different styling. Always check which app you're in before writing styles.

| App | Styling | Port |
|-----|---------|------|
| `client/cms/` | CSS variables + inline `style={{}}` props | 3001 |
| `client/main/` | Tailwind CSS utility classes | 3000 |
| `server/` | TypeScript, no styles | — |

---

## Naming Patterns

**Files:**
- React components: PascalCase — `KitchenBoard.tsx`, `MenuBuilder.tsx`, `CMSSidebar.tsx`
- Pages: always `page.tsx`; layouts: `layout.tsx`
- Hooks: camelCase with `use` prefix — `useDeviceFingerprint.ts`, `useCustomer.ts`
- Utilities/libs: camelCase — `orders.ts`, `orderEvents.ts`, `fingerprint.ts`, `paginate.ts`
- Server route files: camelCase matching the resource — `orders.ts`, `visits.ts`
- Server service files: PascalCase class name — `QRService.ts`, `SentimentService.ts`

**React components:**
- Default exports for pages and primary components; named exports for providers/hooks
- Sub-components as small named functions in the same file, above the default export

**Variables:**
- camelCase; boolean flags prefixed `is`/`has` (`isAdmin`, `hasSubmittedFirstReview`)
- Short loop variables in tight JSX maps (`o` for order/outlet, `v` for visit)

**TypeScript types:**
- PascalCase interfaces; Zod schemas camelCase with `Schema` suffix; inferred types `z.infer<typeof schema>`
- Role union: `'admin' | 'owner' | 'franchise_owner'`

**Server-side:**
- Prisma models PascalCase; `const router = Router()`; middleware camelCase verbs (`requireAuth`, `requireAdmin`)
- Custom error classes carry an HTTP `status` (see `OrderValidationError`)

---

## Styling: CMS (`client/cms/`) — Light Theme

The CMS uses **CSS variables defined in `client/cms/src/styles/globals.css`** applied via inline `style={{}}` props. Do not introduce Tailwind utility classes for layout/color in CMS pages. The CMS moved from a dark theme to a **light** theme — the current tokens are:

```css
/* Brand (red) */
--color-primary:        #D64238
--color-primary-hover:  #B82E25
--color-primary-dim:    rgba(214, 66, 56, 0.08)
--color-primary-border: rgba(214, 66, 56, 0.15)

/* Surfaces (light) */
--color-bg:        #FAF9F6
--color-surface:   #ffffff
--color-surface-2: #F3F2EE
--color-surface-3: #E6E4DD

/* Borders */
--color-border:        rgba(0, 2, 29, 0.06)
--color-border-strong: rgba(0, 2, 29, 0.12)

/* Text (near-black navy #00021D) */
--color-text-1: #00021D
--color-text-2: rgba(0, 2, 29, 0.65)
--color-text-3: rgba(0, 2, 29, 0.45)

/* Semantic */
--color-success: #16a34a
--color-warning: #d97706
--color-danger:  #dc2626
--color-info:    #2563eb

/* Sidebar */
--sidebar-width: 220px
--sidebar-bg:    #efeeeb

/* Radii */
--radius-sm: 6px
--radius-md: 10px
--radius-lg: 16px
--radius-xl: 20px
```

**CMS utility CSS classes** (in globals.css, used via `className`): `.page-header`, `.page-content`, `.page-title`, `.card`, `.stat-card`, `.data-table-wrap`, `.data-table`, `.input`, `.btn-primary`, `.btn-ghost`, `.empty-state*`, `.sidebar-link`, `.bottom-nav-item`, `.role-badge*`.

**CMS inline style pattern:**
```tsx
// Correct: CSS var references
<div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
// Wrong: hardcoded hex in CMS pages — use the token instead
```

---

## Styling: Main App (`client/main/`)

The customer app uses **Tailwind CSS utility classes exclusively** (inline `style={{}}` only for special cases like `colorScheme` or Framer Motion transforms).

**Reusable style strings** are defined as local `const`s at the top of the component file (`inputStyles`, `labelStyles`, `errorStyles`), not as CSS classes.

**Motion (Framer Motion):** interactive elements use `<motion.*>` with `whileHover`/`whileTap`/`initial`/`animate`; standard entrance `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`, easing `[0.4, 0, 0.2, 1]`.

---

## Component Structure

**CMS page pattern:** `'use client'` → in-file sub-components → page default export at bottom → data fetched in `useEffect` via `api.get()` → all state in the page component → ASCII section dividers.

**Main app pattern:** hooks extracted to `client/main/src/hooks/`; forms use `react-hook-form` + `zodResolver` + schema from `client/main/src/lib/validators.ts`.

---

## Import Organization

1. React / Next.js
2. Third-party libraries
3. Internal path-aliased imports (`@/lib/...`)
4. Type-only imports last (`import type`)

**Path aliases:** both clients use `@/` → `src/`. Server uses relative imports only.

---

## Error Handling

**CMS API calls:** `api.get(...).then(setState).catch(console.error).finally(() => setLoading(false))`.

**Main app forms:** `try/catch` with `toast.error(err.response?.data?.message || 'fallback')`, `finally` resets submitting state.

**Server route handlers:** Zod `.parse()` at the top; `try/catch` forwarding to `next(err)`. Order routes additionally catch `OrderValidationError` and respond with its `.status`.

**SSE handlers:** always tear down on `req.on('close')` — `clearInterval(heartbeat)`, `unsubscribe()`, `res.end()`.

---

## Server Route Conventions

- Public routes in `server/src/routes/*.ts`; CMS routes in `server/src/routes/cms/*.ts` with `router.use(requireAuth)` (KDS stream is the exception — token via query param, registered before the guard)
- Apply the right rate limiter to public writes (`writeLimiter`) and auth (`authLimiter`)
- Role-scope filtering pattern: `franchise_owner` pinned to `assignedOutletId`; admins/owners read `req.query.outletId`
- Pagination via `paginate()` from `server/src/lib/paginate.ts`
- **Never trust client-supplied prices** — order prices/names are snapshotted server-side in `createOrderWithItems`

---

## TypeScript Patterns

- `const where: any = {}` for dynamic Prisma filters is an accepted pattern in CMS route files
- Nullish coalescing / optional chaining used throughout
- Non-null assertion on `req.staff!` after `requireAuth`
- Raw SQL only where atomicity is required (daily token upsert in `orders.ts`); columns are camelCase → must be double-quoted in raw SQL

---

## Comments

- ASCII section dividers: `// ─── Section Name ───────`
- Inline context comments for non-obvious business logic (IST business day, price snapshotting, in-process SSE caveat)
- JSDoc used sparingly on shared lib functions and `QRService`

---

## Form Conventions (both apps)

- `react-hook-form` + `zodResolver`; schema in `validators.ts` (main) or inline (CMS)
- `async onSubmit` receiving typed form data; loading via `setSubmitting(true/false)`

---

*Convention analysis: 2026-07-07*
