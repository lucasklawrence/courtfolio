import 'server-only'

import type { CardioData } from '@/types/cardio'
import { createServerSupabaseClient } from '@/lib/supabase/server'

import { assembleCardioData } from './cardio'

/**
 * Server-side cardio dataset reader for Server Components and route
 * handlers. Mirrors the browser-facing {@link import('./cardio').getCardioData}
 * but pulls the per-request Supabase client (anon role + cookie auth)
 * from `lib/supabase/server.ts`. The actual query/validation/assembly
 * logic lives in {@link import('./cardio').assembleCardioData} so the
 * two read paths can't drift.
 *
 * Usage example: `app/training-facility/gym/page.tsx` calls this from
 * its Server Component to hydrate the wall fixtures (HR monitor,
 * VO2max whiteboard, wall scoreboard — PRD §7.4) on the first paint.
 *
 * Returns `null` when all three cardio tables are empty (typical
 * pre-baseline state). Callers should fall back to placeholder
 * fixtures rather than treating it as an error.
 *
 * `server-only` guards against accidental client imports — Next will
 * compile-error rather than ship the cookie-aware client to the
 * browser.
 *
 * @throws See {@link assembleCardioData} — Supabase query failures or
 *   row-shape validation errors. The Gym page wraps this in
 *   `.catch(() => null)` so a flaky read renders the empty fixtures
 *   instead of 500ing the page.
 */
export async function getCardioDataServer(): Promise<CardioData | null> {
  const supabase = await createServerSupabaseClient()
  return assembleCardioData(supabase)
}
