/**
 * Server-only admin-status probe used by the browser-side
 * `useAdminSession` hook to decide whether to render admin-only UI.
 *
 * Returns `{ isAdmin: boolean, email: string | null }` instead of
 * 401/403ing because the client wants to differentiate "show the
 * sign-in nudge" from "show the form" — both are legitimate states,
 * neither is an error.
 *
 * The allowlist itself (`ADMIN_EMAILS`) stays server-only — the
 * browser only ever learns the boolean answer, not the list.
 */

import { NextResponse } from 'next/server'

import { resolveAdminSession } from '@/lib/auth/admin-session'
import { withTelemetry } from '@/lib/telemetry/with-telemetry'

/**
 * Resolve the current viewer's admin status from the session cookies.
 *
 * @returns 200 with `{ isAdmin, email }` on every call, including
 *   logged-out (`{ isAdmin: false, email: null }`). Always JSON.
 *
 * @throws when Supabase env vars are missing (misconfigured deploy).
 *   Auth lookup failures are normalized to logged-out.
 */
async function handleGET(): Promise<NextResponse> {
  const { isAdmin, email } = await resolveAdminSession()
  return NextResponse.json({ isAdmin, email })
}

/** `handleGET` wrapped with one-event-per-request telemetry (#220). */
export const GET = withTelemetry('GET /api/admin/check', handleGET)
