/**
 * Hand-typed sample benchmarks for the Combine empty-state preview
 * (#160). Surfaced when a viewer hits `/training-facility/combine?preview=demo`
 * AND `getMovementBenchmarks()` returns `[]` — gives portfolio
 * reviewers, first-time visitors, and fresh-clone dev environments a
 * concrete idea of what the page is supposed to look like with data.
 *
 * Hand-typed (not auto-derived from a Zod schema) so a real schema
 * change in `types/movement.ts` surfaces here as a TypeScript error
 * rather than silently rendering an outdated shape. Keep the rows
 * plausible — these get embedded in screenshots and demos. The four
 * core metrics roughly trend in the "improving" direction over time
 * (bodyweight ↓, shuttle ↓, vertical ↑, sprint ↓) so the Trading
 * Card / Radar / Scoreboard show the metrics moving the right way.
 *
 * KEEP IN SYNC WITH: `types/movement.ts` (Benchmark). If a new
 * required field is added there, TypeScript will surface it; if a new
 * optional field is added, decide whether the demo should populate it
 * to show the surface that consumes it.
 */

import type { Benchmark } from '@/types/movement'

/**
 * Eight monthly-ish benchmarks across roughly the past six months.
 * First entry is the baseline; later entries trend toward better
 * power-to-weight numbers so the Trading-Card delta arrows point up.
 * Every metric is populated on at least the first and last entries so
 * the Scoreboard's "latest vs first" derivation has both endpoints.
 */
export const COMBINE_DEMO_BENCHMARKS: Benchmark[] = [
  {
    date: '2025-11-04',
    bodyweight_lbs: 248.4,
    shuttle_5_10_5_s: 5.42,
    vertical_in: 19.5,
    sprint_10y_s: 1.97,
    notes: 'Baseline session — first measured set after adding shuttle drills.',
  },
  {
    date: '2025-12-02',
    bodyweight_lbs: 245.1,
    shuttle_5_10_5_s: 5.31,
    vertical_in: 20.1,
    sprint_10y_s: 1.94,
  },
  {
    date: '2026-01-06',
    bodyweight_lbs: 242.8,
    shuttle_5_10_5_s: 5.24,
    vertical_in: 20.5,
    sprint_10y_s: 1.91,
    notes: 'New shoes; cool gym, felt fast on the shuttle.',
  },
  {
    date: '2026-02-03',
    bodyweight_lbs: 240.0,
    shuttle_5_10_5_s: 5.18,
    vertical_in: 21.2,
    sprint_10y_s: 1.89,
  },
  {
    date: '2026-03-03',
    bodyweight_lbs: 237.6,
    shuttle_5_10_5_s: 5.12,
    vertical_in: 21.8,
    sprint_10y_s: 1.86,
  },
  {
    date: '2026-04-07',
    bodyweight_lbs: 235.2,
    shuttle_5_10_5_s: 5.05,
    vertical_in: 22.4,
    sprint_10y_s: 1.83,
    notes: 'Felt explosive — first session under 5.10 on the shuttle.',
  },
  {
    date: '2026-04-21',
    bodyweight_lbs: 234.5,
    is_complete: false,
    notes: 'Cut short, hamstring tweak. Not used in trend calcs.',
  },
  {
    date: '2026-05-01',
    bodyweight_lbs: 232.8,
    shuttle_5_10_5_s: 4.98,
    vertical_in: 23.0,
    sprint_10y_s: 1.81,
    notes: 'Strong session; PRs on shuttle and sprint.',
  },
]
