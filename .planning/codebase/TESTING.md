# Testing

## Verification Strategy
StoneOven prioritizes functional verification and automated regressions across the role hierarchy.

### 1. Manual UAT (User Acceptance Testing)
- **Role Testing**: Verification must be performed as Admin, Owner, and Franchise Owner to ensure data isolation is absolute.
- **Deep-Link Verification**: Validating that URLs like `/customers?outletId=X` correctly pre-filter views.

### 2. Automated Testing (Playwright)
- **E2E Flows**: Automated browser tests cover critical paths:
  - Login → Dashboard.
  - Customer Search & Filter.
  - Review Submission & Feed update.
- **Role Guarding**: Tests that verify 403 Forbidden responses when a Franchise Owner attempts to access Admin-only routes.

### 3. API Smoke Testing
- **Role-Aware Shell**: Custom PowerShell scripts (as seen in recent work) are used to rapidly verify all 3 roles against live API endpoints.
- **Health Checks**: Verification of 200 OK responses and correct scoping of returned arrays.

### 4. Static Analysis
- **TypeScript**: Mandatory `npx tsc --noEmit` check before every major commit.
- **Zod Schema Validation**: Ensures data integrity between frontend forms and backend persistence.
