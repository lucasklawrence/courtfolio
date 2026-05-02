import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CardioData } from '@/types/cardio'

import { assembleCardioData } from './cardio-shared'

/**
 * Server-side cardio dataset reader for Server Components and route
 * handlers. Mirrors the browser-facing {@link import('./cardio').getCardioData}
 * but pulls the per-request Supabase client (anon role + cookie auth)
 * from `lib/supabase/server.ts`. The query / validation / shape
 * assembly live in {@link assembleCardioData} (`./cardio-shared`),
 * which has no `'use client'` / `'server-only'` imports of its own —
 * so the two read paths can't drift, and this file can stay strictly
 * server-side.
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
