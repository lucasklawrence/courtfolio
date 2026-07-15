import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { OtfData, OtfMileageAward } from '@/types/otf'

import { assembleOtfData, assembleOtfMileageAwards } from './otf-shared'

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

/**
 * Server-side reader for the monthly-mileage milestone ladder (#321), for the
 * admin settings page's initial hydration. Wraps {@link assembleOtfMileageAwards}
 * with the request-scoped server client.
 *
 * @throws See {@link assembleOtfMileageAwards}. The settings page
 *   `.catch(() => [])` so a read blip renders an empty editor rather than 500ing.
 */
export async function getOtfMileageAwardsServer(): Promise<OtfMileageAward[]> {
  const supabase = await createServerSupabaseClient()
  return assembleOtfMileageAwards(supabase)
}
