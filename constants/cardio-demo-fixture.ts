/**
 * Hand-typed sample cardio dataset for the empty-state preview (#162,
 * sibling of #160's Combine fixture). Surfaced when a viewer hits a
 * `/training-facility/gym/*` route with `?preview=demo` AND the real
 * fetch returned no sessions — gives portfolio reviewers, first-time
 * visitors, and fresh-clone dev environments a concrete idea of what
 * the wall fixtures, charts, and stat cards look like populated.
 *
 * Hand-typed (not auto-derived from a Zod schema) so a real schema
 * change in `types/cardio.ts` surfaces here as a TypeScript error
 * rather than silently rendering an outdated shape. Plausible numbers
 * — these get embedded in screenshots and demos. The metrics roughly
 * trend in the "improving" direction over time (resting HR ↓, VO2max ↑)
 * so the wall fixtures show progress not noise.
 *
 * Activity mix:
 *   - 5 stair sessions (drives the Stair detail view + HR-zone bars)
 *   - 3 treadmill / running sessions (drives the Treadmill detail view)
 *   - 2 walking sessions (drives the Track detail view)
 *
 * KEEP IN SYNC WITH: `types/cardio.ts` (CardioData / CardioSession /
 * CardioTimePoint). If a new required field is added there, TypeScript
 * will surface it; if a new optional field is added, decide whether
 * the demo should populate it to show the surface that consumes it.
 */

import type { CardioData } from '@/types/cardio'

/** Module-level constant; never mutate. Components consume by reference. */
export const CARDIO_DEMO_DATA: CardioData = {
  // Pinned timestamp so the wall's "last synced" label is stable across
  // refreshes during a demo. Real `imported_at` comes from
  // `MAX(updated_at)` on the live tables.
  imported_at: '2026-05-01T08:00:00Z',
  sessions: [
    {
      date: '2025-12-06T07:30:00Z',
      activity: 'stair',
      duration_seconds: 1320,
      avg_hr: 138,
      max_hr: 156,
      hr_seconds_in_zone: { 1: 80, 2: 540, 3: 580, 4: 110, 5: 10 },
    },
    {
      date: '2026-01-10T07:30:00Z',
      activity: 'stair',
      duration_seconds: 1500,
      avg_hr: 144,
      max_hr: 162,
      hr_seconds_in_zone: { 1: 60, 2: 480, 3: 660, 4: 270, 5: 30 },
    },
    {
      date: '2026-02-14T07:30:00Z',
      activity: 'stair',
      duration_seconds: 1740,
      avg_hr: 150,
      max_hr: 169,
      hr_seconds_in_zone: { 1: 40, 2: 420, 3: 720, 4: 480, 5: 80 },
    },
    {
      date: '2026-03-21T07:30:00Z',
      activity: 'stair',
      duration_seconds: 1860,
      avg_hr: 154,
      max_hr: 173,
      hr_seconds_in_zone: { 1: 30, 2: 380, 3: 740, 4: 580, 5: 130 },
    },
    {
      date: '2026-04-25T07:30:00Z',
      activity: 'stair',
      duration_seconds: 2040,
      avg_hr: 158,
      max_hr: 178,
      hr_seconds_in_zone: { 1: 15, 2: 280, 3: 760, 4: 720, 5: 265 },
    },
    {
      date: '2026-02-18T18:00:00Z',
      activity: 'running',
      duration_seconds: 1380,
      distance_meters: 3000,
      avg_hr: 152,
      max_hr: 169,
      pace_seconds_per_km: 460,
    },
    {
      date: '2026-03-14T18:00:00Z',
      activity: 'running',
      duration_seconds: 1500,
      distance_meters: 3500,
      avg_hr: 156,
      max_hr: 174,
      pace_seconds_per_km: 429,
    },
    {
      date: '2026-04-18T18:00:00Z',
      activity: 'running',
      duration_seconds: 1620,
      distance_meters: 4000,
      avg_hr: 159,
      max_hr: 177,
      pace_seconds_per_km: 405,
    },
    {
      date: '2026-03-08T13:00:00Z',
      activity: 'walking',
      duration_seconds: 1800,
      distance_meters: 2400,
      avg_hr: 96,
      max_hr: 110,
      pace_seconds_per_km: 750,
    },
    {
      date: '2026-04-12T13:00:00Z',
      activity: 'walking',
      duration_seconds: 1950,
      distance_meters: 2700,
      avg_hr: 98,
      max_hr: 112,
      pace_seconds_per_km: 722,
    },
  ],
  resting_hr_trend: [
    { date: '2025-12-06', value: 64 },
    { date: '2026-01-10', value: 63 },
    { date: '2026-02-14', value: 61 },
    { date: '2026-03-14', value: 59 },
    { date: '2026-04-18', value: 58 },
    { date: '2026-04-25', value: 57 },
  ],
  vo2max_trend: [
    { date: '2025-12-06', value: 40.5 },
    { date: '2026-02-14', value: 41.8 },
    { date: '2026-03-21', value: 42.6 },
    { date: '2026-04-25', value: 43.4 },
  ],
}
