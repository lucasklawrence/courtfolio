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
 * @param request Incoming POST. Only the URL is used (for the redirect base).
 * @returns 303 redirect to `/` on success, JSON 500 with an error
 *   message when Supabase reports a sign-out failure (so the caller
 *   surfaces it instead of silently leaving the session active).
 * @throws when Supabase env vars are missing (misconfigured deploy).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    return NextResponse.json(
      { error: `Failed to sign out: ${error.message}` },
      { status: 500 },
    )
  }
  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
