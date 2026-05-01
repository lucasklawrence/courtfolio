/**
 * Sign the current user out and redirect to `/`.
 *
 * POST-only so a stray GET (a prefetch or a logged-out crawler hitting
 * the URL) cannot silently terminate someone's session — POST also
 * lets the form button trigger sign-out without a navigation.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * End the Supabase session for the requesting user and 303-redirect
 * to the home page so the response navigates to a fresh GET (browser
 * follows 303 with GET regardless of the original method).
 *
 * **Failure mode:** when Supabase's `signOut()` reports an error we
 * still redirect to `/` rather than returning JSON 500. The route is
 * called from a native `<form>` POST (#151), and a JSON-error response
 * would navigate the browser to a raw error page. The Supabase SSR
 * cookie helper has already attempted to clear the session cookies as
 * part of `signOut()`; on the rare API failure the user lands on the
 * home page, the admin gate flips to non-admin (since the cookies are
 * either gone or about to expire), and the error is logged
 * server-side for debugging. If the admin somehow remains signed in
 * they can retry from the panel.
 *
 * @param request Incoming POST. Only the URL is used (for the redirect base).
 * @returns 303 redirect to `/` on both success and Supabase-reported
 *   failure (see "Failure mode" above for the rationale).
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('[auth/sign-out] Supabase signOut failed:', error.message)
  }
  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
