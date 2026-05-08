import { getBrowserSupabaseClient } from '@/lib/supabase/browser'
import type { WeightRoomData } from '@/types/weight-room'

import { assembleWeightRoomData } from './weight-room-shared'

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
