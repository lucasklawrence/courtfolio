import 'server-only'

import { NextResponse } from 'next/server'

import { canPerformAdminWrites } from '@/lib/supabase/admin'
import { resolveAdminSession } from './admin-session'

/**
 * Message returned with the 503 when a deployment has no write credentials.
 * Shared so the API-key-authenticated routes, which don't use
 * {@link requireAdmin}, answer identically.
 */
export const ADMIN_WRITES_UNAVAILABLE =
  'Admin writes are unavailable on this deployment. Preview deployments read staging data ' +
  'and intentionally carry no write credentials.'

/**
 * Result of an admin-authorization check on an incoming request.
 *
 * - `ok: true` — the caller is signed in and on the allowlist; `email`
 *   is the verified admin email.
 * - `ok: false` — the caller is rejected; `response` is a ready-to-return
 *   `NextResponse` (401 if not signed in, 403 if signed in but not admin,
 *   503 if admin writes are unavailable on this deployment).
 */
export type AdminCheck =
  | { ok: true; email: string }
  | { ok: false; response: NextResponse }

/**
 * Verify the current request may perform an admin write. Reads the Supabase
 * session from cookies, checks the user's verified email against the
 * {@link getAdminAllowlist} list, then confirms this deployment actually holds
 * the service-role credential such a write needs.
 *
 * Use at the top of every `/api/admin/*` route handler:
 *
 * ```ts
 * const auth = await requireAdmin()
 * if (!auth.ok) return auth.response
 * // ... continue with admin-only work
 * ```
 *
 * **Why the capability check lives here.** Every caller goes on to build a
 * service-role client, so a deployment without that credential can only fail —
 * previously by throwing out of {@link createAdminSupabaseClient} into an opaque
 * 500. Preview deployments are exactly that case *by design*: they ship without
 * `SUPABASE_SERVICE_ROLE_KEY` so pull-request code, which is auto-deployed and
 * unreviewed, cannot write any database. Answering 503 turns a stack trace into
 * a stated limitation.
 *
 * Auth is checked **before** capability deliberately: an anonymous caller gets
 * 401, never a 503 that would disclose how the deployment is configured.
 *
 * @throws when the Supabase *read* env vars are missing (misconfiguration). Auth
 *   failure and absent write credentials are returned as `{ ok: false }`.
 */
export async function requireAdmin(): Promise<AdminCheck> {
  const { signedIn, email, isAdmin } = await resolveAdminSession()
  if (!signedIn) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }),
    }
  }
  if (!isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Admin only.' }, { status: 403 }),
    }
  }
  if (!canPerformAdminWrites()) {
    return {
      ok: false,
      response: NextResponse.json({ error: ADMIN_WRITES_UNAVAILABLE }, { status: 503 }),
    }
  }
  // `isAdmin` is only true when the allowlist matched a non-null email.
  return { ok: true, email: email as string }
}
