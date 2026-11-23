import 'server-only'

import { cookies } from 'next/headers'

/**
 * End-to-end admin session stub (#481).
 *
 * The Weight Room's `/log` and `/settings` 404 for anyone but the admin, and
 * CI has no Supabase credentials to sign in with, so no automated check could
 * reach them. This lets the e2e suite act as the admin against a throwaway
 * local Supabase fake (`e2e/fake-supabase/server.mjs`), and nowhere else.
 *
 * It fails closed. All four conditions must hold, and each one alone is
 * enough to switch it off:
 *
 * 1. `NODE_ENV` is not `production`. `next build`, `next start` and every
 *    Vercel deploy run as production, and Next inlines `NODE_ENV` at build
 *    time, so the stub is compiled out of every deployed bundle.
 * 2. `E2E_ADMIN_STUB=1`, set only by the `e2e:dev:admin` npm script.
 * 3. `NEXT_PUBLIC_SUPABASE_URL` points at a loopback host. A stubbed session
 *    can therefore only ever read or write the local fake. Setting the flag in
 *    a shell that also holds production credentials does nothing.
 * 4. The request carries the {@link E2E_ADMIN_COOKIE} cookie set to `1`, so
 *    the same server still treats every other request as anonymous.
 *
 * `ADMIN_EMAILS` is never consulted or changed. The stub's identity,
 * {@link E2E_ADMIN_EMAIL}, is a reserved `.test` address that is never on it.
 */

/** Cookie a Playwright test sets to ask for the stubbed admin session. */
export const E2E_ADMIN_COOKIE = 'cv-e2e-admin'

/** Email the stubbed session reports. `.test` is reserved and never routable. */
export const E2E_ADMIN_EMAIL = 'e2e-admin@example.test'

/** Hostnames that resolve to this machine and nowhere else. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])

/**
 * Whether a URL's host is loopback. Anything unparseable is treated as not
 * loopback, so a malformed value can't switch the stub on.
 *
 * @param raw A URL such as `http://127.0.0.1:54329`.
 */
export function isLoopbackUrl(raw: string | undefined): boolean {
  if (!raw) return false
  try {
    return LOOPBACK_HOSTS.has(new URL(raw).hostname)
  } catch {
    return false
  }
}

/**
 * The process-level guards (1–3 above): could this server ever grant the stub?
 *
 * Reads `process.env.NODE_ENV` directly rather than through a parameter so the
 * production build can inline it and drop the branch.
 */
export function isE2eAdminStubEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.E2E_ADMIN_STUB !== '1') return false
  return isLoopbackUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

/**
 * Whether the current request gets the stubbed admin session: every process
 * guard holds and the request asked for it with {@link E2E_ADMIN_COOKIE}.
 *
 * Cookies are read only once the process guards pass, so on a normal server
 * this costs nothing and touches no request state.
 */
export async function isE2eAdminStubActive(): Promise<boolean> {
  if (!isE2eAdminStubEnabled()) return false
  const store = await cookies()
  return store.get(E2E_ADMIN_COOKIE)?.value === '1'
}
