'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireSupabaseEnv } from './env'

let cachedClient: SupabaseClient | undefined

/**
 * Lazy-singleton Supabase client for client components and browser-side
 * hooks. Wires session storage to cookies via `@supabase/ssr` so the
 * same auth state is visible to server route handlers via
 * {@link createServerSupabaseClient}.
 *
 * Singletoned because the auth-state subscription would otherwise be
 * duplicated on every render — and because callers expect referential
 * stability so they can compare instances in effect deps.
 *
 * @throws Error from `requireSupabaseEnv()` when
 *   `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is
 *   missing or empty.
 */
export function getBrowserSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    const { url, anonKey } = requireSupabaseEnv()
    cachedClient = createBrowserClient(url, anonKey)
  }
  return cachedClient
}

/**
 * Test-only escape hatch — clears the cached client so a subsequent
 * call rebuilds it. Tests that mutate Supabase env stubs between cases
 * rely on this to avoid a cross-test bleed where the first env's
 * client survives into the next test.
 */
export function __resetBrowserSupabaseClientForTests(): void {
  cachedClient = undefined
}
