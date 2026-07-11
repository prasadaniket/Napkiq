import type { LoginResponse } from '@/types/api'

const TOKEN_KEY = 'cms_token'
const USER_KEY = 'cms_user'

// ─── Cookie helpers ────────────────────────────────────────────────────────────
// Mirrors client/cms/src/lib/auth.ts. Cookies are set from JS so they CANNOT be
// HttpOnly; the proper hardening is for the backend to issue HttpOnly+Secure
// cookies (tracked follow-up). Until then, Secure + SameSite=Strict limits the
// exposure and avoids leaving the JWT in localStorage.

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === 'undefined') return
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict${secure}`
}

export function getCookie(name: string): string | null {
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
  setCookie(TOKEN_KEY, data.token)
  setCookie(USER_KEY, JSON.stringify(data))
}

export const getToken = (): string | null => getCookie(TOKEN_KEY)

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
  deleteCookie(USER_KEY)
}

export const isAuthenticated = (): boolean => {
  return !!getToken()
}
