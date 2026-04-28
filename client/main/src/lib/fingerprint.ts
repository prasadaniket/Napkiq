import FingerprintJS from '@fingerprintjs/fingerprintjs'

const STORAGE_KEY = 'so_device_id'

let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null

const initFingerprint = () => {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load()
  }
  return fpPromise
}

export const getDeviceFingerprint = async (): Promise<string> => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) return cached
  } catch {
    // localStorage unavailable (SSR or private browsing)
  }

  try {
    const fp = await initFingerprint()
    const result = await fp.get()
    const id = result.visitorId
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // ignore storage write errors
    }
    return id
  } catch {
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
  }
}
