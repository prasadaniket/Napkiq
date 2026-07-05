import type { LoginResponse } from '@/types/api'

const TOKEN_KEY   = 'cms_token'
const REFRESH_KEY = 'cms_refresh_token'
const USER_KEY    = 'cms_user'

// ─── Cookie helpers ────────────────────────────────────────────────────────────

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  // Secure on HTTPS (skipped on http://localhost so dev still works); SameSite=Strict.
  // NOTE: these cookies are set from JS and therefore CANNOT be HttpOnly. The
  // proper hardening is for the backend to issue HttpOnly+Secure cookies — tracked
  // as a follow-up. Until then, Secure + SameSite=Strict limits the exposure.
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  // path=/ ensures the cookie is readable by the middleware at any route
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict${secure}`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict`
}

// ─── Session API ───────────────────────────────────────────────────────────────

export const saveSession = (data: LoginResponse) => {
  setCookie(TOKEN_KEY,   data.token)
  if (data.refreshToken) setCookie(REFRESH_KEY, data.refreshToken)
  setCookie(USER_KEY, JSON.stringify(data))
}

export const getToken        = (): string | null => getCookie(TOKEN_KEY)
export const getRefreshToken = (): string | null => getCookie(REFRESH_KEY)

export const saveTokens = (accessToken: string, refreshToken: string) => {
  setCookie(TOKEN_KEY,   accessToken)
  setCookie(REFRESH_KEY, refreshToken)
}

export const getUser = (): LoginResponse | null => {
  const raw = getCookie(USER_KEY)
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const clearSession = () => {
  deleteCookie(TOKEN_KEY)
  deleteCookie(REFRESH_KEY)
  deleteCookie(USER_KEY)
}

export const isAuthenticated = (): boolean => !!getToken()
