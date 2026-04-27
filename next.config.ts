import type { NextConfig } from 'next'

/**
 * Baseline CSP directives emitted in report-only mode during the
 * security-hardening rollout.
 *
 * The value is serialized as a single semicolon-delimited header
 * string so it can be passed directly to
 * `Content-Security-Policy-Report-Only`. The current allowlist keeps
 * the policy compatible with the existing app shell, inline JSON-LD,
 * Framer Motion styles, and Vercel Analytics
 * (`https://va.vercel-scripts.com`).
 */
const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com",
  'upgrade-insecure-requests',
].join('; ')

/**
 * Optional alternate build output directory used by the Playwright
 * smoke suite so the feature-flagged and default dev servers do not
 * share the same client bundle cache.
 */
const distDir = process.env.NEXT_DIST_DIR || '.next'

const nextConfig: NextConfig = {
  distDir,
  /**
   * Applies baseline security response headers to every route in the
   * app, including public assets and App Router pages.
   *
   * @returns Next.js header rules that enforce the non-CSP headers now
   *   and emit CSP in report-only mode while the app is still being
   *   tuned for stricter inline-script/style handling.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy-Report-Only',
            value: contentSecurityPolicyReportOnly,
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value:
              'accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), browsing-topics=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
