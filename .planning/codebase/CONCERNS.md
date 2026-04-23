# Concerns

## High Priority

### Data Isolation
- **Risk**: Franchise owners seeing data from other outlets.
- **Mitigation**: Standardized `resolveOutletFilter` helper in the backend to lock every Prisma query.

### Performance
- **Risk**: Sluggish dashboard loading due to heavy aggregation queries.
- **Mitigation**: Parallelizing `Promise.all` queries and implementing selective field selection in Prisma.

### Auth Expiry
- **Risk**: Users losing work due to Supabase session expiry.
- **Mitigation**: Token refresh interceptors in `lib/api.ts` to automatically renew JWTs before 401s occur.

## Active Development

### Asset Management
- **Status**: Cloudinary integration is in progress.
- **Focus**: Ensuring secure, signed uploads and optimized image delivery.

### Automation Engine
- **Status**: Planned.
- **Focus**: Building the worker service to trigger WhatsApp communications based on Customer visit patterns and anniversaries.

## Security

### RBAC Hardening
- **Current**: 3 roles (Admin, Owner, Franchise).
- **Audit**: Periodic verification that new routes are correctly guarded by `requireAuth` and role-specific checks.
