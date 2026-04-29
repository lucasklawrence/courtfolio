'use server'

import { headers } from 'next/headers'

import { createServerSupabaseClient } from '@/lib/supabase/server'

/** Discriminated result of {@link sendMagicLink}. */
export type SendMagicLinkResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Server action: send a Supabase Auth OTP magic link to `email`.
 *
 * The link's `emailRedirectTo` points at this site's `/auth/callback`
 * route on the same origin so the user lands back here after clicking.
 * Whether the email is on the admin allowlist is enforced at the
 * route-handler layer ({@link requireAdmin}); a non-admin can sign in
 * but every `/api/admin/*` call will return 403.
 *
 * @param email Email entered into the login form.
 * @returns `{ ok: true }` on success, `{ ok: false, error }` on a
 *   Supabase error (e.g. malformed email, rate-limited).
 */
export async function sendMagicLink(email: string): Promise<SendMagicLinkResult> {
  const trimmed = email.trim()
  if (!trimmed) {
    return { ok: false, error: 'Enter an email.' }
  }
  const supabase = await createServerSupabaseClient()
  const origin = await getRequestOrigin()
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Resolve the request's origin from headers. Vercel always sets
 * `x-forwarded-proto`; local dev (regardless of whether the host
 * resolves as `localhost`, `127.0.0.1`, or another loopback variant
 * the e2e harness might use) never does. Default to `http` when the
 * header is absent so dev redirects don't try TLS.
 *
 * @throws Error when the `host` header is missing — this should never
 *   happen on a real request and indicates a misconfigured proxy.
 */
async function getRequestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  if (!host) {
    throw new Error('Cannot determine request origin (missing host header).')
  }
  return `${proto}://${host}`
}
