/**
 * Supabase Auth magic-link callback. The link in the email points here
 * with a `?code=...` PKCE param; this handler exchanges that for a
 * session, sets the session cookies, and redirects to the `next`
 * query param (defaults to `/`).
 *
 * Failure modes redirect to `/admin/login?error=...` so the user sees
 * a visible message instead of a blank page or a stale stuck state.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Exchange the URL's `?code=` for a Supabase session.
 *
 * @param request Incoming GET request from the magic-link click.
 * @returns A redirect response — to `next` on success, to the login
 *   page with an error param on failure.
 * @throws when Supabase env vars are missing (misconfigured deploy).
 *   Auth-exchange failures (expired/invalid code) are surfaced as a
 *   redirect to `/admin/login?error=...`, not thrown.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = sanitizeNext(url.searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(
      new URL('/admin/login?error=missing_code', request.url),
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/admin/login?error=${encodeURIComponent(error.message)}`,
        request.url,
      ),
    )
  }

  return NextResponse.redirect(new URL(next, request.url))
}

/**
 * Restrict `?next=` to same-origin paths so an attacker can't craft a
 * magic-link variant that redirects to an external URL post-auth.
 * Defaults to `/` for missing or non-relative values.
 */
function sanitizeNext(raw: string | null): string {
  if (!raw) return '/'
  // Reject scheme-bearing URLs and protocol-relative redirects.
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) {
    return '/'
  }
  return raw.startsWith('/') ? raw : '/'
}
