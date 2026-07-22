import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// These are the pathname values as Next.js sees them AFTER stripping basePath (/cms)
const PUBLIC_PATHS = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const token = request.cookies.get('cms_token')?.value
  const user = request.cookies.get('cms_user')?.value
  const hasValidAuth = Boolean(token && user)

  // Public paths — allow through, but bounce authenticated users away from /login
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    if (hasValidAuth && pathname === '/login') {
      const analyticsUrl = request.nextUrl.clone()
      analyticsUrl.pathname = '/analytics'
      return NextResponse.redirect(analyticsUrl)
    }
    return NextResponse.next()
  }

  // Allow Next.js internals and static logo assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/logo') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  if (!hasValidAuth) {
    // Build the redirect URL preserving the base origin
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('from', pathname)

    const response = NextResponse.redirect(loginUrl)
    if (token || user) {
      response.cookies.delete('cms_token')
      response.cookies.delete('cms_refresh_token')
      response.cookies.delete('cms_user')
    }
    return response
  }

  return NextResponse.next()
}

export const config = {
  // Run on all paths — we manually filter inside the function
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
