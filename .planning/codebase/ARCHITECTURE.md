# Architecture

## System Design
StoneOven follows a decoupled client-server architecture with strict role-based data isolation.

### 1. Data Access & Security (RBAC)
The system implements a 3-tier role hierarchy:
- **Admin (UniCord)**: Global access to all outlets, audit logs, and system settings.
- **Owner**: Full access to all outlets and customer data, focused on performance analytics.
- **Franchise Owner**: Strictly scoped access. Can only view data (Customers, Visits, Reviews) belonging to their `assignedOutletId`.

### 2. Frontend Strategy (Next.js CMS)
- **Middleware-First Guarding**: Authentication is enforced at the edge using `src/middleware.ts`, checking for the `cms_token` cookie before allowing route entry.
- **Server-Side Fetching**: Pages leverage `api.ts` with interceptors to handle data fetching from the Node.js backend.
- **Deep Linking**: URL-based filtering (`?outletId=`) allows seamless navigation between high-level analytics and granular customer lists.

### 3. Backend Strategy (Express + Prisma)
- **Route Modularization**: Logic is split into clear domains (`customers.ts`, `outlets.ts`, `reviews.ts`, `visits.ts`).
- **Scoping Utility**: Uses a `resolveOutletFilter` helper in Prisma queries to automatically apply role-based filters to every database fetch, ensuring franchise owners never leak data from other outlets.
- **Analytics Aggregation**: Uses parallel `Promise.all` queries to generate rich performance summaries for dashboard views.

### 4. Persistence
- **Relational Integrity**: PostgreSQL ensures consistency between Customers, Outlets, and their many-to-many Visit/Review relationships.
- **Migrations**: Strict schema versioning via Prisma migrations.
