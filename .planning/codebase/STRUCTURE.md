# Structure

## Directory Map

### `client/cms/src`
- **`app/`**: Next.js App Router root.
  - **`(cms)/`**: Grouped routes for the authenticated portal.
    - **`outlets/`**: Performance dashboards and individual outlet deep-dives.
    - **`customers/`**: Filterable customer list and detailed profile pages.
    - **`reviews/`**: Feedback management with star distribution analytics.
    - **`visits/`**: Activity timeline and visit history.
- **`components/`**: Shared and domain-specific UI components.
  - **`cms/`**: Specialized components like `ReviewCard`, `Initials` avatar, etc.
- **`context/`**: React contexts for Auth and global state.
- **`lib/`**: Utilities like `api.ts` (Axios) and `validators.ts` (Zod).
- **`types/`**: Centralized TypeScript interfaces (matching backend DTOs).

### `server/src`
- **`routes/cms/`**: Domain-driven API handlers.
  - `customers.ts`: CRUD and analytics for customer profiles.
  - `outlets.ts`: Performance stats and aggregation.
  - `reviews.ts`: Feedback processing and star distribution.
  - `visits.ts`: Visit logging and history.
- **`middleware/`**: Shared logic like `auth.ts` for RBAC.
- **`lib/`**: Prisma client and pagination helpers.

### `server/prisma`
- `schema.prisma`: The source of truth for the database schema.
- `migrations/`: Versioned history of database changes.

### `worker/`
- (Placeholder/Planned): Background tasks for WhatsApp automation and scheduled reporting.
