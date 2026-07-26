import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'

import { isAdminEmail } from './admin-allowlist'

/**
 * Shared server-side admin-session read (#345).
 *
 * The same three steps — read the Supabase session from cookies, pull the
 * verified email, check it against the allowlist — were written out
 * independently in three places: {@link import('./require-admin').requireAdmin}
 * (401/403 for API routes), {@link import('./require-admin-page').requireAdminPage}
 * (404 for pages), and `app/api/admin/check/route.ts` (a JSON boolean). Each
 * differs only in how it *reports* the answer, so the answer itself lives here
 * and they can't drift.
 *
 * Server-only: the allowlist must never reach the browser bundle, which is why
 * `ADMIN_EMAILS` is deliberately not a `NEXT_PUBLIC_*` var.
 */

/** The current viewer's authentication and authorization state. */
export interface AdminSessionState {
  /**
   * Whether a Supabase session resolved to a user at all. Distinguished from
   * {@link isAdmin} because API routes answer "not signed in" with 401 and
   * "signed in but not on the allowlist" with 403 — different remedies.
   */
  signedIn: boolean
  /** Verified email of the signed-in user, or `null` when signed out. */
  email: string | null
  /** True only when {@link signedIn} and {@link email} is on the allowlist. */
  isAdmin: boolean
}

/**
 * Resolve the current request's admin session from its cookies.
 *
 * An auth lookup error is normalized to signed-out rather than thrown: a
 * missing or expired cookie is an ordinary state, not a failure.
 *
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
export async function resolveAdminSession(): Promise<AdminSessionState> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { signedIn: false, email: null, isAdmin: false }
  }
  const email = data.user.email ?? null
  return { signedIn: true, email, isAdmin: isAdminEmail(email) }
}

/**
 * Whether the current viewer is an admin, as a plain boolean.
 *
 * For *soft* gating in Server Components — showing or hiding admin-only UI on
 * a page that renders for everyone. The other two helpers both reject the
 * request ({@link import('./require-admin-page').requireAdminPage} 404s,
 * {@link import('./require-admin').requireAdmin} returns a 401/403 response),
 * which is wrong when the page itself is public.
 *
 * This exists so public pages can pass `isAdmin` down as a prop instead of
 * letting a client component call `useAdminSession` — that hook builds a
 * browser Supabase client purely to watch for auth changes, which inlines
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` into any bundle that reaches it (#345).
 *
 * Trade-off: a prop is resolved once per render, so admin UI won't appear
 * until the next navigation after signing in. On a public page that's worth
 * not publishing a database credential.
 *
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
export async function isAdminRequest(): Promise<boolean> {
  const { isAdmin } = await resolveAdminSession()
  return isAdmin
}
