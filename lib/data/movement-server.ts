import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Benchmark } from '@/types/movement'

import { assembleMovementBenchmarks } from './movement-shared'

/**
 * Server-side Combine benchmark reader (#345) for Server Components and route
 * handlers. Mirrors the browser-facing
 * {@link import('./movement').getMovementBenchmarks} but pulls the per-request
 * Supabase client (anon role + cookie auth) from `lib/supabase/server.ts`. The
 * query / validation / shape assembly live in
 * {@link assembleMovementBenchmarks} (`./movement-shared`), so the two read
 * paths can't drift.
 *
 * Exists so the Gym's track and treadmill views can render their benchmark
 * overlays without a client-side Supabase import — which would inline the anon
 * key into a publicly reachable bundle.
 *
 * `server-only` guards against accidental client imports: Next will
 * compile-error rather than ship the cookie-aware client to the browser.
 *
 * @throws See {@link assembleMovementBenchmarks} — Supabase query failures or
 *   row-shape validation errors. Callers usually downgrade this to an empty
 *   render.
 */
export async function getMovementBenchmarksServer(): Promise<Benchmark[]> {
  const supabase = await createServerSupabaseClient()
  return assembleMovementBenchmarks(supabase)
}
