import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS — only call from
 * server-side code (route handlers, server actions). Importing this
 * module from a client component would bundle the secret key into the
 * browser; the file deliberately omits the `'use client'` directive
 * and the env var it reads is server-only (no `NEXT_PUBLIC_` prefix).
 *
 * The client disables session persistence and auto-refresh because the
 * service-role key is the credential — there's no user session to
 * maintain. Each route-handler invocation calls this fresh; the
 * underlying client is cheap (HTTP keep-alive, no socket).
 *
 * @throws Error when `NEXT_PUBLIC_SUPABASE_URL` or
 *   `SUPABASE_SERVICE_ROLE_KEY` is not set.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.')
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
