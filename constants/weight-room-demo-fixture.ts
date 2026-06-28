/**
 * Hand-typed sample Weight Room dataset for the Today View's
 * empty-state preview (#80, sibling of #160 Combine and #162 cardio).
 * Surfaced when a viewer hits `/training-facility/weight-room?preview=demo`
 * AND the real fetch returns an empty/null read — gives portfolio
 * reviewers, first-time visitors, and fresh-clone dev environments a
 * concrete idea of what the activity rings look like with progress.
 *
 * Built as a *function* (not a const) because the Today View is
 * "today-relative" — we need today's date plus a few days back so the
 * rings show partial progress now and the streak badge has data to
 * lean on. The function is invoked at hydration time in the client
 * data island, so SSR vs client clock drift never lands on the user.
 *
 * Hand-typed (not auto-derived from a Zod schema) so a real schema
 * change in `types/weight-room.ts` surfaces here as a TypeScript error
 * rather than silently rendering an outdated shape.
 *
 * KEEP IN SYNC WITH: `types/weight-room.ts`. If a new required field
 * lands on `StrengthSet` / `ExerciseGoal`, TypeScript will surface it.
 */

import type { ExerciseGoal, StrengthSet, WeightRoomData } from '@/types/weight-room'

/** Default goals seeded by the migration; the demo mirrors them. */
const DEMO_GOALS: ExerciseGoal[] = [
  { exercise: 'pushups', daily_target: 100, color: '#EA580C' },
  { exercise: 'pullups', daily_target: 30, color: '#0EA5A1' },
]

/**
 * Per-day plan relative to "today". Index 0 = today, 1 = yesterday,
 * etc. Each day lists `{ exercise, reps[] }` rows; the builder fans
 * those out into individual `StrengthSet` rows with synthesized ids
 * and timestamps.
 *
 * Today is intentionally *partial* (75/100 pushups, 20/30 pullups) so
 * the rings render mid-fill — the most representative state for a
 * "grease the groove" page. The five days before today all hit goal
 * to feed a current streak; further back has a missed day so the
 * "longest" streak number is interesting too.
 */
const DEMO_DAY_PLAN: Array<{ exercise: string; reps: number[] }>[] = [
  // 0 — today (partial)
  [
    { exercise: 'pushups', reps: [25, 25, 25] },
    { exercise: 'pullups', reps: [10, 10] },
  ],
  // 1 — yesterday (goal hit on both)
  [
    { exercise: 'pushups', reps: [25, 25, 25, 25] },
    { exercise: 'pullups', reps: [10, 10, 10] },
  ],
  // 2
  [
    { exercise: 'pushups', reps: [30, 30, 25, 25] },
    { exercise: 'pullups', reps: [10, 10, 10, 5] },
  ],
  // 3
  [
    { exercise: 'pushups', reps: [25, 25, 25, 25] },
    { exercise: 'pullups', reps: [10, 10, 10] },
  ],
  // 4
  [
    { exercise: 'pushups', reps: [20, 20, 20, 20, 20] },
    { exercise: 'pullups', reps: [8, 8, 8, 6] },
  ],
  // 5
  [
    { exercise: 'pushups', reps: [25, 25, 25, 25] },
    { exercise: 'pullups', reps: [10, 10, 10] },
  ],
  // 6 — missed day on pullups, hit on pushups (so the pullups streak
  //      breaks here but pushups keeps a longer all-time longest)
  [
    { exercise: 'pushups', reps: [25, 25, 25, 25] },
    { exercise: 'pullups', reps: [5, 5] },
  ],
  // 7
  [
    { exercise: 'pushups', reps: [25, 25, 25, 25] },
    { exercise: 'pullups', reps: [10, 10, 10] },
  ],
  // 8
  [
    { exercise: 'pushups', reps: [25, 25, 25, 25] },
    { exercise: 'pullups', reps: [10, 10, 10] },
  ],
]

/**
 * Subtract `n` days from a Date and return an ISO timestamp at the
 * given hour-of-day. Stays in the caller's local timezone — Today
 * View math reads everything in local time (per
 * {@link import('@/lib/training-facility/strength-today').toLocalDateKey})
 * so the demo's timestamps need to match.
 */
function isoDaysAgo(now: Date, daysAgo: number, hour: number, minute = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

/**
 * Build today-relative demo {@link WeightRoomData}. Called from the
 * client data island when the real read is empty AND the URL has
 * `?preview=demo`.
 *
 * The seed `now` is parameterized so unit tests can pin a specific
 * "today" — production callers omit it and get system time.
 *
 * @param now Optional override; defaults to `new Date()`.
 */
export function buildWeightRoomDemoData(now: Date = new Date()): WeightRoomData {
  const sets: StrengthSet[] = []
  let counter = 0
  for (let dayIndex = 0; dayIndex < DEMO_DAY_PLAN.length; dayIndex++) {
    const rows = DEMO_DAY_PLAN[dayIndex]
    // Spread the day's sets across waking hours so the timestamps
    // read like a "grease the groove" cadence rather than a single
    // session. Hour offsets are deterministic so SetList ordering is
    // stable across renders.
    let hour = 7
    for (const row of rows) {
      for (const reps of row.reps) {
        sets.push({
          id: `demo-${dayIndex}-${counter++}`,
          logged_at: isoDaysAgo(now, dayIndex, hour, (counter * 7) % 60),
          exercise: row.exercise,
          reps,
        })
        hour += 2
        if (hour > 21) hour = 21
      }
      hour += 1
    }
  }
  // Sort oldest → newest so the shape matches the live read path.
  sets.sort((a, b) => (a.logged_at < b.logged_at ? -1 : a.logged_at > b.logged_at ? 1 : 0))
  return {
    imported_at: now.toISOString(),
    sets,
    goals: DEMO_GOALS,
    // The empty-state preview demonstrates the permanent rings; a
    // monthly focus (#255) is date-windowed and would only render in
    // its month, so the demo leaves it empty rather than faking an
    // always-active campaign.
    monthly_focus: [],
  }
}
