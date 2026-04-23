# Conventions

## Frontend Patterns
- **Premium Dark Aesthetics**: Exclusively uses the established dark theme (`#0a0a0a` background, surface-based cards, orange primary accents).
- **Component-Level Styles**: Vanilla CSS in standard files or inline styles for layout-critical values (avoiding bulky libraries).
- **Icon Strategy**: Custom SVG icons or Lucide icons, ensuring a consistent minimal stroke weight.
- **Data Fetching**: Use the `api` singleton from `lib/api.ts`. Always handle loading/empty states.
- **Naming**: PascalCase for components, camelCase for variables/functions.

## Backend Patterns
- **RBAC Enforcement**: Every CMS route must use the `requireAuth` middleware and respect the `staff.role` for data filtering.
- **Parallel Execution**: Leverage `Promise.all` for aggregate queries (stats) to minimize latency.
- **Type-First**: Shared or mirrored types between client and server via `types/api.ts`.
- **Stateless Auth**: Use JWTs for authentication, stored in cookies for SSR compatibility.

## Quality Standards
- **Zero TypeScript Errors**: The codebase must always pass `npx tsc --noEmit`.
- **Debounced Interaction**: Any search or heavy filter must use a `useDebounce` hook (default 400ms-500ms).
- **Responsive Tables**: Use `data-table-wrap` and `data-table` classes to ensure horizontal scrolling on mobile.
