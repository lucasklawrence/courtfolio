import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { OtfData } from '@/types/otf'

import { assembleOtfData } from './otf-shared'

/**
 * Server-side OrangeTheory dataset reader (SSR / Server Components). Wraps
 * the shared {@link assembleOtfData} helper with the request-scoped server
 * Supabase client. Mirrors `getCardioDataServer` in `lib/data/cardio-server.ts`.
 *
 * @throws See {@link assembleOtfData}. Server callers typically
 *   `.catch(() => null)` and render the empty state.
 */
export async function getOtfDataServer(): Promise<OtfData | null> {
  const supabase = await createServerSupabaseClient()
  return assembleOtfData(supabase)
}
