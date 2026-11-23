import fs from 'node:fs'
import path from 'node:path'
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

/**
 * Workspace root for a git worktree whose `node_modules` is a junction to the
 * main checkout's install, or `undefined` everywhere else.
 *
 * `scripts/worktree-init.ps1` links a worktree's `node_modules` to the main
 * checkout's. Turbopack refuses to read files outside its workspace root, which
 * it infers as the directory holding the nearest lockfile, so it cannot follow
 * that link and fails with "Could not find the Next.js package". Worktrees live
 * under the main checkout (`.claude/worktrees/<slug>`), so widening the root to
 * the directory the link resolves into puts both trees inside it.
 *
 * Keyed on the link itself rather than on an env var or a path pattern, so it
 * can only ever change anything where a linked install exists: Vercel and CI
 * install a real `node_modules` and get the default root.
 *
 * @param cwd Project directory to inspect; defaults to where Next was started.
 */
export function linkedWorktreeRoot(cwd: string = process.cwd()): string | undefined {
  const modules = path.join(cwd, 'node_modules')
  try {
    if (!fs.lstatSync(modules).isSymbolicLink()) return undefined
    return path.dirname(fs.realpathSync(modules))
  } catch {
    return undefined
  }
}

const workspaceRoot = linkedWorktreeRoot()

const nextConfig: NextConfig = {
  distDir,
  ...(workspaceRoot && {
    turbopack: { root: workspaceRoot },
    outputFileTracingRoot: workspaceRoot,
  }),
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
