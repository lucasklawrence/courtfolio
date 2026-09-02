import { getBrowserSupabaseClient } from '@/lib/supabase/browser'
import type { WeightRoomAchievement, WeightRoomData, WeightRoomExercise } from '@/types/weight-room'

import {
  assembleWeightRoomAchievements,
  assembleWeightRoomData,
  assembleWeightRoomExercises,
} from './weight-room-shared'

/**
 * Browser-side Weight Room dataset reader (#79). Wraps the shared
 * {@link assembleWeightRoomData} helper with the cached browser
 * Supabase client.
 *
 * Component-side data islands (Today View, History View — slices #80
 * and #81) call this from a client effect; the SSR side uses
 * `getWeightRoomDataServer` in `lib/data/weight-room-server.ts`.
 *
 * Both entries delegate to `assembleWeightRoomData` in
 * `lib/data/weight-room-shared.ts`, so the read shape, column
 * whitelist, and validation can't drift between server and client.
 *
 * @throws See {@link assembleWeightRoomData} — Supabase query failures
 *   or row-shape validation errors. Callers usually downgrade this to
 *   an empty render via `?? { imported_at: '', sets: [], goals: [] }`.
 */
export async function getWeightRoomData(): Promise<WeightRoomData | null> {
  return assembleWeightRoomData(getBrowserSupabaseClient())
}

/**
 * Browser-side reader for the Trophy Room achievement ladder (#336). Wraps
 * {@link assembleWeightRoomAchievements} with the cached browser client.
 *
 * Returns an empty array (never `null`) when no tiers are configured — see
 * {@link assembleWeightRoomAchievements}.
 *
 * @throws See {@link assembleWeightRoomAchievements}. The Trophy Room
 *   downgrades this to an empty ladder rather than failing the page.
 */
export async function getWeightRoomAchievements(): Promise<WeightRoomAchievement[]> {
  return assembleWeightRoomAchievements(getBrowserSupabaseClient())
}

/**
 * Browser-side reader for the movement roster (#373). Wraps
 * {@link assembleWeightRoomExercises} with the cached browser client.
 *
 * Returns an empty array (never `null`) when the roster is empty, and includes
 * archived movements — callers that render a picker should filter them out.
 *
 * @throws See {@link assembleWeightRoomExercises}.
 */
export async function getWeightRoomExercises(): Promise<WeightRoomExercise[]> {
  return assembleWeightRoomExercises(getBrowserSupabaseClient())
}
