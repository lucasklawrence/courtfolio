import 'server-only'

import { NextResponse } from 'next/server'

import { resolveAdminSession } from './admin-session'

/**
 * Result of an admin-authorization check on an incoming request.
 *
 * - `ok: true` — the caller is signed in and on the allowlist; `email`
 *   is the verified admin email.
 * - `ok: false` — the caller is rejected; `response` is a ready-to-return
 *   `NextResponse` (401 if not signed in, 403 if signed in but not admin).
 */
export type AdminCheck =
  | { ok: true; email: string }
  | { ok: false; response: NextResponse }

/**
 * Verify the current request is from an admin. Reads the Supabase
 * session from cookies, then checks the user's verified email against
 * the {@link getAdminAllowlist} list.
 *
 * Use at the top of every `/api/admin/*` route handler:
 *
 * ```ts
 * const auth = await requireAdmin()
 * if (!auth.ok) return auth.response
 * // ... continue with admin-only work
 * ```
 *
 * @throws when Supabase env vars are missing (misconfiguration). Auth
 *   failure (no session, wrong email) is returned as `{ ok: false }`.
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
  // `isAdmin` is only true when the allowlist matched a non-null email.
  return { ok: true, email: email as string }
}
