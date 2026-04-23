import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// These are the pathname values as Next.js sees them AFTER stripping basePath (/cms)
const PUBLIC_PATHS = ['/login']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public paths — allow through, but bounce authenticated users away from /login
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const token = request.cookies.get('cms_token')?.value
    if (token && pathname === '/login') {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      return NextResponse.redirect(dashboardUrl)
    }
    return NextResponse.next()
  }

  // Allow Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  const token = request.cookies.get('cms_token')?.value

  if (!token) {
    // Build the redirect URL preserving the base origin
    // basePath (/cms) is prepended automatically by Next.js when we use nextUrl
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Run on all paths — we manually filter inside the function
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
