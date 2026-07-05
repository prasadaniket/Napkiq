/** @type {import('next').NextConfig} */

// Baseline security headers applied to every response. The CSP is intentionally
// limited to non-resource-restricting directives (frame-ancestors / object-src /
// base-uri) so it hardens clickjacking + base-tag injection without risking
// breakage of script/style/API loading. A full resource CSP (with nonces) is a
// tracked follow-up that needs runtime testing.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
]

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.napkiq.in' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
