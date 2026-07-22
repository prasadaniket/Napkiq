// Device identity for the no-login customer experience.
//
// SECURITY: this id gates access to a customer's own PII and order history
// (GET /customers/by-device/:id, GET /orders/by-device/:id), so it must be an
// unguessable, non-colliding secret — NOT a browser fingerprint. We generate a
// random v4 UUID (122 bits of entropy) and persist it in localStorage. A
// fingerprint (e.g. FingerprintJS visitorId) is deterministic and collision-prone,
// so two different customers could be assigned the same id and see each other's
// data — that is exactly what this design avoids.
//
// The storage key is versioned (`napkiq_device_id`) so any device still holding a
// legacy fingerprint value under the old key gets a fresh random token instead of
// reusing it.

const STORAGE_KEY = 'napkiq_device_id'

/** Cryptographically-random device id, with a best-effort fallback. */
const generateId = (): string => {
  try {
    return crypto.randomUUID()
  } catch {
    // Very old browsers without crypto.randomUUID — still random, no fingerprint.
    return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  }
}

// Name kept as `getDeviceFingerprint` so existing callers (useDeviceFingerprint
// and everything downstream) need no changes.
export const getDeviceFingerprint = async (): Promise<string> => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) return cached

    const id = generateId()
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    // localStorage unavailable (SSR or private browsing) — return an ephemeral id.
    return generateId()
  }
}
