import { getBrowserSupabaseClient } from '@/lib/supabase/browser'
import type { CardioData } from '@/types/cardio'

import { assembleCardioData } from './cardio-shared'

/**
 * Browser-side cardio dataset reader. Wraps the shared
 * {@link assembleCardioData} helper with the cached browser Supabase
 * client. Component-side data islands (`StairDetailView`,
 * `TreadmillDetailView`, `TrackDetailView`, `AllCardioOverview`) call
 * this from a client effect; the SSR side uses `getCardioDataServer`
 * in `lib/data/cardio-server.ts`.
 *
 * Both entry points delegate to `assembleCardioData` in
 * `lib/data/cardio-shared.ts`, so the read shape, column whitelist,
 * and validation can't drift between server and client.
 *
 * @throws See {@link assembleCardioData} — Supabase query failures or
 *   row-shape validation errors. Callers usually downgrade this to an
 *   empty render via `?? { imported_at: '', sessions: [], ... }`.
 */
export async function getCardioData(): Promise<CardioData | null> {
  return assembleCardioData(getBrowserSupabaseClient())
}
