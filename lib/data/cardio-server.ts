import 'server-only'

import { z } from 'zod'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  CardioSessionHrSampleRowSchema,
  CardioSessionRowSchema,
  hrSampleRowToHrSample,
  sessionRowToCardioSession,
} from '@/lib/schemas/cardio'
import type { CardioData, CardioSession, HrSample } from '@/types/cardio'

import { assembleCardioData, fetchAllRows, stripNulls } from './cardio-shared'

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

/** Whitelisted columns for the per-session read — mirrors `CardioSessionRowSchema`. */
const SESSION_COLUMNS =
  'started_at, activity, duration_seconds, distance_meters, avg_hr, max_hr, ' +
  'pace_seconds_per_km, zone1_seconds, zone2_seconds, zone3_seconds, ' +
  'zone4_seconds, zone5_seconds, meters_per_heartbeat'

/** Whitelisted columns for the HR-sample read. */
const HR_SAMPLE_COLUMNS = 'session_started_at, sample_at, bpm'

/** Aggregate-row + sample-stream payload returned by {@link getCardioSession}. */
export interface CardioSessionDetail {
  /** The session row, mapped into the legacy {@link CardioSession} shape. */
  session: CardioSession
  /** Raw HR samples for the session, sorted oldest → newest. May be empty. */
  samples: HrSample[]
}

/**
 * Server-side reader for the per-session detail page (#165). Looks up one
 * `cardio_sessions` row by its `started_at` PK and the matching rows in
 * `cardio_session_hr_samples`, returning both as a single payload.
 *
 * Returns `null` when no session exists at the given timestamp — the
 * caller (`/training-facility/gym/session/[started_at]`) maps that to a
 * 404 via `notFound()`.
 *
 * `started_at` is a `timestamptz` PK; PostgREST normalizes the user's URL
 * input the same way it normalizes stored values, so passing the raw
 * decoded timestamp string from the route param works without
 * pre-canonicalization.
 *
 * @param startedAt The session's `started_at` PK. Decoded from the URL by
 *   the page route (the timestamps contain `:` and `+`, which are
 *   percent-encoded in the path segment).
 * @throws when either Supabase query fails or returns rows that fail
 *   schema validation. The page wraps this in `.catch(() => null)` so a
 *   flaky read 404s instead of 500ing.
 */
export async function getCardioSession(
  startedAt: string,
): Promise<CardioSessionDetail | null> {
  const supabase = await createServerSupabaseClient()
  // A busy 60-minute class can log >1000 HR samples (one session already
  // has 1287), which is PostgREST's per-response cap — so the samples must
  // be paged, or the tail of the HR curve is silently dropped. See
  // {@link fetchAllRows}.
  const [sessionRes, samplesRaw] = await Promise.all([
    supabase
      .from('cardio_sessions')
      .select(SESSION_COLUMNS)
      .eq('started_at', startedAt)
      .maybeSingle(),
    fetchAllRows(
      () =>
        supabase
          .from('cardio_session_hr_samples')
          .select(HR_SAMPLE_COLUMNS)
          .eq('session_started_at', startedAt)
          .order('sample_at', { ascending: true }),
      'cardio_session_hr_samples',
    ),
  ])

  if (sessionRes.error) {
    throw new Error(`Failed to load cardio session: ${sessionRes.error.message}`)
  }
  if (!sessionRes.data) return null

  const sessionRaw = stripNulls(sessionRes.data as unknown as Record<string, unknown>)
  const sessionParsed = CardioSessionRowSchema.safeParse(sessionRaw)
  if (!sessionParsed.success) {
    throw new Error(
      `cardio_sessions row failed schema validation: ${sessionParsed.error.message}`,
    )
  }

  const samplesParsed = z.array(CardioSessionHrSampleRowSchema).safeParse(samplesRaw)
  if (!samplesParsed.success) {
    throw new Error(
      `cardio_session_hr_samples failed schema validation: ${samplesParsed.error.message}`,
    )
  }

  return {
    session: sessionRowToCardioSession(sessionParsed.data),
    samples: samplesParsed.data.map(hrSampleRowToHrSample),
  }
}
