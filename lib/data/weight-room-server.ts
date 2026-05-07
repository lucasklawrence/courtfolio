import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { WeightRoomData } from '@/types/weight-room'

import { assembleWeightRoomData } from './weight-room-shared'

/**
 * Server-side Weight Room dataset reader (#79) for Server Components
 * and route handlers. Mirrors the browser-facing {@link import('./weight-room').getWeightRoomData}
 * but pulls the per-request Supabase client (anon role + cookie auth)
 * from `lib/supabase/server.ts`. The query / validation / shape
 * assembly live in {@link assembleWeightRoomData}
 * (`./weight-room-shared`), so the two read paths can't drift.
 *
 * Returns `null` when both tables are empty (typical pre-baseline
 * state — the migration seeds two default goals so this branch is
 * rare in practice). Callers should fall back to placeholder fixtures
 * rather than treating it as an error.
 *
 * `server-only` guards against accidental client imports — Next will
 * compile-error rather than ship the cookie-aware client to the browser.
 *
 * @throws See {@link assembleWeightRoomData} — Supabase query failures
 *   or row-shape validation errors.
 */
export async function getWeightRoomDataServer(): Promise<WeightRoomData | null> {
  const supabase = await createServerSupabaseClient()
  return assembleWeightRoomData(supabase)
}
