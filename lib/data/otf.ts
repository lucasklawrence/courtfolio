import { getBrowserSupabaseClient } from '@/lib/supabase/browser'
import type { OtfData } from '@/types/otf'

import { assembleOtfData } from './otf-shared'

/**
 * Browser-side OrangeTheory dataset reader. Wraps the shared
 * {@link assembleOtfData} helper with the cached browser Supabase client.
 * The OTF detail view (`OtfDetailView`) calls this from a client effect; an
 * SSR caller would use `getOtfDataServer` in `lib/data/otf-server.ts`.
 *
 * @throws See {@link assembleOtfData} — Supabase query or row-shape
 *   validation failures. Callers usually downgrade this to an empty render.
 */
export async function getOtfData(): Promise<OtfData | null> {
  return assembleOtfData(getBrowserSupabaseClient())
}
