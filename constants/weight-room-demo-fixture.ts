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

import { templateToPrescription } from '@/lib/schemas/weight-room'
import type {
  ExerciseGoal,
  StrengthSet,
  WeightRoomData,
  WeightRoomExercise,
  WeightRoomWorkout,
  WorkoutTemplate,
} from '@/types/weight-room'

/**
 * Default goals seeded by the migration; the demo mirrors them.
 *
 * `display_name` is set here for the same reason the live read joins it (#384):
 * preview mode substitutes this fixture wholesale, so without it the demo would
 * be the one surface still rendering raw slugs.
 */
const DEMO_GOALS: ExerciseGoal[] = [
  { exercise: 'pushups', display_name: 'Pushups', daily_target: 100, color: '#EA580C' },
  { exercise: 'pullups', display_name: 'Pullups', daily_target: 30, color: '#0EA5A1' },
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

/**
 * Sample data for the workout surfaces' empty-state preview (#377), surfaced at
 * `/training-facility/weight-room/workouts?preview=demo` when no session has
 * been recorded.
 *
 * Deliberately a *fixture* rather than seeded database rows: the workout
 * surfaces would otherwise be reviewable only by fabricating training that never
 * happened. The same `?preview=demo` contract as the Today and History views
 * applies — it activates only when the real read is empty, so it can never
 * overlay or misrepresent a real log.
 *
 * Shaped to exercise every branch of the summary at once, which is also what
 * makes it useful as a design reference: a substituted slot, a slot finished
 * short, extra work off-template, a bodyweight movement contributing reps but no
 * tonnage, a two-dumbbell movement whose `load_multiplier` doubles it, and two
 * runs of one template so the comparison block has something to compare.
 */
export interface WorkoutDemoData {
  /** Two sessions, newest first. */
  workouts: WeightRoomWorkout[]
  /** Every set belonging to them, oldest first. */
  sets: StrengthSet[]
  /** The one template both sessions ran. */
  templates: WorkoutTemplate[]
  /** Catalog rows for the movements used, carrying `load_multiplier`. */
  exercises: WeightRoomExercise[]
}

/** Stable ids so a preview link keeps working across renders. */
const DEMO_TEMPLATE_ID = 'demo-template-chest'
const DEMO_SLOT_IDS = {
  bench: 'demo-slot-bench',
  incline: 'demo-slot-incline',
  fly: 'demo-slot-fly',
  dips: 'demo-slot-dips',
} as const

/** Catalog rows behind the demo template. Multipliers are what make the dumbbell tonnage honest. */
const DEMO_EXERCISES: WeightRoomExercise[] = [
  {
    slug: 'barbell-bench-press',
    display_name: 'Barbell Bench Press',
    equipment: 'barbell',
    muscle_group: 'chest',
  },
  {
    slug: 'dumbbell-bench-press',
    display_name: 'Dumbbell Bench Press',
    equipment: 'dumbbell',
    muscle_group: 'chest',
    load_multiplier: 2,
  },
  {
    slug: 'incline-dumbbell-press',
    display_name: 'Incline Dumbbell Press',
    equipment: 'dumbbell',
    muscle_group: 'chest',
    load_multiplier: 2,
  },
  {
    slug: 'cable-fly',
    display_name: 'Cable Fly',
    equipment: 'cable',
    muscle_group: 'chest',
  },
  { slug: 'dips', display_name: 'Dips', equipment: 'bodyweight', muscle_group: 'chest' },
  { slug: 'pushups', display_name: 'Pushups', equipment: 'bodyweight', muscle_group: 'chest' },
]

/** The demo template — four slots, one of which declares the swap the newer session takes. */
const DEMO_TEMPLATE: WorkoutTemplate = {
  id: DEMO_TEMPLATE_ID,
  name: 'Chest Day 1',
  color: '#EA580C',
  category: 'push',
  position: 0,
  slots: [
    {
      id: DEMO_SLOT_IDS.bench,
      position: 0,
      exercise: 'barbell-bench-press',
      target_sets: 4,
      target_reps: 8,
      target_weight_lbs: 155,
      steps: [],
      alternates: [{ id: 'demo-alt-1', exercise: 'dumbbell-bench-press', position: 0 }],
    },
    {
      id: DEMO_SLOT_IDS.incline,
      position: 1,
      exercise: 'incline-dumbbell-press',
      target_sets: 4,
      target_reps: 10,
      target_weight_lbs: 50,
      steps: [],
      alternates: [],
    },
    {
      id: DEMO_SLOT_IDS.fly,
      position: 2,
      exercise: 'cable-fly',
      target_sets: 3,
      target_reps: 12,
      target_weight_lbs: 30,
      steps: [],
      alternates: [],
    },
    {
      id: DEMO_SLOT_IDS.dips,
      position: 3,
      exercise: 'dips',
      target_sets: 3,
      steps: [],
      alternates: [],
    },
  ],
}

/**
 * One demo set, before it's stamped with a timestamp.
 *
 * `slot` absent marks extra work — a set inside the session that no slot
 * prescribed, which is exactly how the real recording surface records it.
 */
interface DemoSetPlan {
  exercise: string
  reps: number
  weight?: number
  slot?: string
}

/** The older session: everything prescribed, done as prescribed. */
const DEMO_PREVIOUS_SETS: DemoSetPlan[] = [
  { exercise: 'barbell-bench-press', reps: 8, weight: 155, slot: DEMO_SLOT_IDS.bench },
  { exercise: 'barbell-bench-press', reps: 8, weight: 155, slot: DEMO_SLOT_IDS.bench },
  { exercise: 'barbell-bench-press', reps: 8, weight: 155, slot: DEMO_SLOT_IDS.bench },
  { exercise: 'barbell-bench-press', reps: 7, weight: 155, slot: DEMO_SLOT_IDS.bench },
  { exercise: 'incline-dumbbell-press', reps: 10, weight: 50, slot: DEMO_SLOT_IDS.incline },
  { exercise: 'incline-dumbbell-press', reps: 10, weight: 50, slot: DEMO_SLOT_IDS.incline },
  { exercise: 'incline-dumbbell-press', reps: 9, weight: 50, slot: DEMO_SLOT_IDS.incline },
  { exercise: 'incline-dumbbell-press', reps: 8, weight: 50, slot: DEMO_SLOT_IDS.incline },
  { exercise: 'cable-fly', reps: 12, weight: 30, slot: DEMO_SLOT_IDS.fly },
  { exercise: 'cable-fly', reps: 12, weight: 30, slot: DEMO_SLOT_IDS.fly },
  { exercise: 'cable-fly', reps: 11, weight: 30, slot: DEMO_SLOT_IDS.fly },
  { exercise: 'dips', reps: 12, slot: DEMO_SLOT_IDS.dips },
  { exercise: 'dips', reps: 10, slot: DEMO_SLOT_IDS.dips },
  { exercise: 'dips', reps: 9, slot: DEMO_SLOT_IDS.dips },
]

/**
 * The newer session: the rack was taken, so the bench slot ran on dumbbells and
 * came up a set short, the incline went up 5 lb a hand (a load PR), and a few
 * pushup sets went in off-template.
 */
const DEMO_LATEST_SETS: DemoSetPlan[] = [
  { exercise: 'dumbbell-bench-press', reps: 8, weight: 65, slot: DEMO_SLOT_IDS.bench },
  { exercise: 'dumbbell-bench-press', reps: 8, weight: 65, slot: DEMO_SLOT_IDS.bench },
  { exercise: 'dumbbell-bench-press', reps: 7, weight: 65, slot: DEMO_SLOT_IDS.bench },
  { exercise: 'incline-dumbbell-press', reps: 10, weight: 55, slot: DEMO_SLOT_IDS.incline },
  { exercise: 'incline-dumbbell-press', reps: 10, weight: 55, slot: DEMO_SLOT_IDS.incline },
  { exercise: 'incline-dumbbell-press', reps: 9, weight: 55, slot: DEMO_SLOT_IDS.incline },
  { exercise: 'incline-dumbbell-press', reps: 8, weight: 55, slot: DEMO_SLOT_IDS.incline },
  { exercise: 'cable-fly', reps: 12, weight: 30, slot: DEMO_SLOT_IDS.fly },
  { exercise: 'cable-fly', reps: 12, weight: 30, slot: DEMO_SLOT_IDS.fly },
  { exercise: 'cable-fly', reps: 12, weight: 30, slot: DEMO_SLOT_IDS.fly },
  { exercise: 'dips', reps: 14, slot: DEMO_SLOT_IDS.dips },
  { exercise: 'dips', reps: 11, slot: DEMO_SLOT_IDS.dips },
  { exercise: 'dips', reps: 10, slot: DEMO_SLOT_IDS.dips },
  { exercise: 'pushups', reps: 25 },
  { exercise: 'pushups', reps: 25 },
]

/**
 * Fan a session's plan out into {@link StrengthSet} rows, one every three
 * minutes from the session's start so the ordering and density read like a real
 * gym visit rather than fourteen sets at the same instant.
 */
function buildDemoWorkout(
  workoutId: string,
  startedAt: Date,
  durationMinutes: number,
  plan: readonly DemoSetPlan[]
): { workout: WeightRoomWorkout; sets: StrengthSet[] } {
  const sets = plan.map((entry, index) => {
    const loggedAt = new Date(startedAt.getTime() + (index + 1) * 3 * 60_000)
    return {
      id: `${workoutId}-set-${index}`,
      logged_at: loggedAt.toISOString(),
      exercise: entry.exercise,
      reps: entry.reps,
      ...(entry.weight === undefined ? {} : { weight_lbs: entry.weight }),
      workout_id: workoutId,
      position: index,
      ...(entry.slot === undefined ? {} : { template_slot_id: entry.slot }),
    } satisfies StrengthSet
  })

  return {
    workout: {
      id: workoutId,
      started_at: startedAt.toISOString(),
      ended_at: new Date(startedAt.getTime() + durationMinutes * 60_000).toISOString(),
      template_id: DEMO_TEMPLATE_ID,
      // Carried so the preview exercises the snapshot read path (#377) rather
      // than the pre-snapshot fallback — the demo should render what a real
      // session renders.
      prescription: templateToPrescription(DEMO_TEMPLATE),
      title: DEMO_TEMPLATE.name,
      location: 'gym',
    },
    sets,
  }
}

/**
 * Build today-relative demo workout data.
 *
 * @param now Optional override; defaults to system time. Tests pin it.
 */
/**
 * Sessions imported from Apple Health (#413), as the preview renders them.
 *
 * Included because they are the *majority* case once a real import runs — 507
 * of them against a handful of recorded sessions — so a preview showing only
 * fully-recorded workouts would misrepresent what the page actually looks like.
 * They carry duration and HR and nothing else, which is exactly what Health
 * knows.
 *
 * `[daysAgo, durationMinutes, avgHr, maxHr]`.
 */
const DEMO_IMPORTED: Array<[number, number, number, number]> = [
  [16, 47, 112, 148],
  [23, 54, 105, 127],
  [30, 41, 98, 121],
  [37, 62, 118, 156],
]

export function buildWorkoutDemoData(now: Date = new Date()): WorkoutDemoData {
  // Anchored to 6pm on each day rather than to `now`, so the fixture reads as
  // evening gym sessions regardless of when the page is loaded.
  const evening = (daysAgo: number): Date => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0)
    d.setDate(d.getDate() - daysAgo)
    return d
  }

  const previous = buildDemoWorkout('demo-workout-1', evening(9), 58, DEMO_PREVIOUS_SETS)
  const latest = buildDemoWorkout('demo-workout-2', evening(2), 52, DEMO_LATEST_SETS)

  const imported: WeightRoomWorkout[] = DEMO_IMPORTED.map(
    ([daysAgo, durationMinutes, avgHr, maxHr], index) => {
      const startedAt = evening(daysAgo)
      return {
        id: `demo-imported-${index}`,
        started_at: startedAt.toISOString(),
        ended_at: new Date(startedAt.getTime() + durationMinutes * 60_000).toISOString(),
        // No template, no title, no sets — and deliberately no location, since
        // Health does not record one.
        source: 'apple_health',
        avg_hr: avgHr,
        max_hr: maxHr,
      }
    }
  )

  return {
    workouts: [latest.workout, previous.workout, ...imported],
    sets: [...previous.sets, ...latest.sets],
    templates: [DEMO_TEMPLATE],
    exercises: DEMO_EXERCISES,
  }
}
