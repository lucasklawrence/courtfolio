import { getBrowserSupabaseClient } from '@/lib/supabase/browser'
import type { OtfData, OtfMileageAward } from '@/types/otf'

import { assembleOtfData, assembleOtfMileageAwards } from './otf-shared'

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

/**
 * Browser-side reader for the monthly-mileage milestone ladder (#321). Wraps
 * {@link assembleOtfMileageAwards} with the cached browser client; the OTF
 * mileage section fetches it alongside {@link getOtfData} from a client effect.
 *
 * @throws See {@link assembleOtfMileageAwards}. The view downgrades this to an
 *   empty ladder so a read blip can't blank the page.
 */
export async function getOtfMileageAwards(): Promise<OtfMileageAward[]> {
  return assembleOtfMileageAwards(getBrowserSupabaseClient())
}
