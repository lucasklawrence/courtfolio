import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { WeightRoomAchievement, WeightRoomData } from '@/types/weight-room'

import {
  assembleWeightRoomAchievements,
  assembleWeightRoomData,
} from './weight-room-shared'

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

/**
 * Server-side reader for the Trophy Room achievement ladder (#336) — used by
 * the `/training-facility/weight-room/achievements` page and the Settings
 * page's initial hydration. Wraps {@link assembleWeightRoomAchievements} with
 * the per-request SSR client.
 *
 * Returns an empty array (never `null`) when no tiers are configured — see
 * {@link assembleWeightRoomAchievements}.
 *
 * @throws See {@link assembleWeightRoomAchievements}. Both call sites
 *   downgrade this to an empty ladder rather than failing the page.
 */
export async function getWeightRoomAchievementsServer(): Promise<WeightRoomAchievement[]> {
  const supabase = await createServerSupabaseClient()
  return assembleWeightRoomAchievements(supabase)
}
