# Testing Patterns

**Analysis Date:** 2026-04-28

## Current State: No Tests Exist

There are zero test files in this codebase. No test runner, no test configuration, and no test utilities are installed across any of the three apps (`client/cms/`, `client/main/`, `server/`).

```bash
# Confirmed: no test files found
find . -name "*.test.*" -o -name "*.spec.*"  # returns nothing
```

No `jest.config.*`, `vitest.config.*`, or equivalent config files are present. No testing libraries appear in any `package.json` `dependencies` or `devDependencies`.

---

## What Needs Testing (Priority Order)

### High Priority — Business-Critical Logic

**Server: Visit deduplication (`server/src/routes/visits.ts`)**
- Logic: one visit per device per outlet per hour
- Risk: double-counting visits corrupts customer engagement metrics
- Test: POST same `deviceId + outletId` twice within an hour — second call should return existing visit

**Server: Role-scoped data filtering (`server/src/routes/cms/visits.ts`, `server/src/routes/cms/customers.ts`)**
- Logic: `franchise_owner` role is hard-constrained to their `assignedOutletId`; admins/owners see all outlets
- Risk: data leak across franchise boundaries
- Test: make CMS requests as `franchise_owner` and verify response never contains other outlets' data

**Server: Pagination utility (`server/src/lib/paginate.ts`)**
- Pure function — easy to unit test
- Test: edge cases: empty list, single item, last page, page beyond total

**Client: Zod validators (`client/main/src/lib/validators.ts`)**
- Pure schemas — easy to unit test without rendering
- Test: `firstVisitFormSchema` with married + no anniversary date should fail; phone regex `^[6-9]\d{9}$`

### Medium Priority — Integration Points

**Server: Auth middleware (`server/src/middleware/auth.ts`)**
- Test: missing Authorization header returns 401; invalid token returns 401; inactive staff returns 403

**Server: CMS route auth enforcement**
- Test: all `/api/cms/*` routes reject unauthenticated requests

**Client: `useCustomer` hook (`client/main/src/hooks/useCustomer.ts`)**
- Test: 404 response from API does not set error state (expected for new devices)
- Test: non-404 errors set the error state

**Client: `useDeviceFingerprint` hook (`client/main/src/hooks/useDeviceFingerprint.ts`)**
- Test: returns `deviceId` after fingerprint resolves; `loading` starts true, becomes false

### Lower Priority — UI Behaviour

**CMS pages:** Filter state management, debounced search, pagination controls
**Main app forms:** Star rating interaction, conditional anniversary date field (shown only when Married)

---

## Recommended Test Stack (Not Yet Installed)

### Server

```bash
npm install -D jest @types/jest ts-jest supertest @types/supertest
```

Config: `server/jest.config.ts`

```ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
}
```

Use `supertest` to test Express routes without starting a real HTTP server. Mock `prisma` and `supabaseAdmin` with `jest.mock()`.

### Client (CMS and Main)

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom
```

Config: `vitest.config.ts` in each client app.

Use `@testing-library/react` for component/hook tests. Mock `@/lib/api` with `vi.mock()`.

---

## Test File Placement (Convention to Follow)

Place test files co-located with source:

```
server/src/
  lib/
    paginate.ts
    paginate.test.ts          ← unit tests alongside source
  routes/
    visits.ts
    visits.test.ts
  middleware/
    auth.ts
    auth.test.ts

client/main/src/
  lib/
    validators.ts
    validators.test.ts
  hooks/
    useCustomer.ts
    useCustomer.test.ts
```

---

## Patterns to Use When Tests Are Written

### Server Unit Test (Pure Function)

```ts
// server/src/lib/paginate.test.ts
import { paginate } from './paginate'

describe('paginate', () => {
  it('returns correct structure for first page', () => {
    const result = paginate(['a', 'b'], 10, 0, 2)
    expect(result.content).toEqual(['a', 'b'])
    expect(result.totalElements).toBe(10)
    expect(result.totalPages).toBe(5)
    expect(result.first).toBe(true)
    expect(result.last).toBe(false)
  })

  it('marks last page correctly', () => {
    const result = paginate(['x'], 1, 0, 20)
    expect(result.last).toBe(true)
  })
})
```

### Server Route Integration Test

```ts
// server/src/routes/visits.test.ts
import request from 'supertest'
import { createApp } from '../../app'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({
  prisma: {
    customerVisit: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    customer: { update: jest.fn() },
  },
}))

const app = createApp()

describe('POST /api/visits', () => {
  it('returns 201 and creates visit for new device', async () => {
    (prisma.customerVisit.findFirst as jest.Mock).mockResolvedValue(null)
    ;(prisma.customerVisit.create as jest.Mock).mockResolvedValue({ id: 'v1' })

    const res = await request(app).post('/api/visits').send({
      deviceId: 'device-abc',
      outletId: '00000000-0000-0000-0000-000000000001',
      visitType: 'qr_scan',
    })

    expect(res.status).toBe(201)
    expect(prisma.customerVisit.create).toHaveBeenCalled()
  })

  it('returns 200 and skips creation for duplicate within 1 hour', async () => {
    (prisma.customerVisit.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' })

    const res = await request(app).post('/api/visits').send({
      deviceId: 'device-abc',
      outletId: '00000000-0000-0000-0000-000000000001',
      visitType: 'qr_scan',
    })

    expect(res.status).toBe(200)
    expect(prisma.customerVisit.create).not.toHaveBeenCalled()
  })
})
```

### Client Zod Schema Test

```ts
// client/main/src/lib/validators.test.ts
import { firstVisitFormSchema } from './validators'

describe('firstVisitFormSchema', () => {
  const validBase = {
    fullName: 'Jane Doe',
    phone: '9876543210',
    email: 'jane@example.com',
    birthDate: '1990-01-01',
    maritalStatus: 'Unmarried' as const,
    gender: 'Female' as const,
    stars: 4,
  }

  it('accepts valid unmarried submission', () => {
    expect(() => firstVisitFormSchema.parse(validBase)).not.toThrow()
  })

  it('rejects married submission without anniversary date', () => {
    const result = firstVisitFormSchema.safeParse({
      ...validBase,
      maritalStatus: 'Married',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid Indian phone number', () => {
    const result = firstVisitFormSchema.safeParse({
      ...validBase,
      phone: '1234567890',  // starts with 1, not valid
    })
    expect(result.success).toBe(false)
  })
})
```

### Client Hook Test

```ts
// client/main/src/hooks/useCustomer.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { useCustomer } from './useCustomer'
import { api } from '@/lib/api'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

describe('useCustomer', () => {
  it('returns null customer on 404 without error', async () => {
    (api.get as any).mockRejectedValue({ response: { status: 404 } })
    const { result } = renderHook(() => useCustomer('device-123'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.customer).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
```

---

## Coverage Goals (When Tests Are Added)

Suggested minimum targets:
- `server/src/lib/` utilities: 100%
- `server/src/middleware/`: 90%+
- `server/src/routes/visits.ts` (public): 90%+
- `server/src/routes/cms/` (role enforcement paths): 80%+
- `client/main/src/lib/validators.ts`: 100%
- `client/main/src/hooks/`: 70%+

---

## Mock Strategy

**Prisma:** Always mock at the module level with `jest.mock('../../lib/prisma')`. Never hit a real database in tests.

**Supabase:** Mock `supabaseAdmin.auth.getUser` to return a fake user object or an error.

**Axios (client):** Mock `@/lib/api` with `vi.mock('@/lib/api')` and control return values per test.

**FingerprintJS (`client/main/src/lib/fingerprint.ts`):** Mock `getDeviceFingerprint` to return a fixed string.

**sessionStorage:** Use `vi.stubGlobal('sessionStorage', ...)` or the built-in jsdom implementation.

---

*Testing analysis: 2026-04-28*
