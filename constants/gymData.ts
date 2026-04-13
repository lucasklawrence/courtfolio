// ─── Types ──────────────────────────────────────────────────────────────────
// Designed to map cleanly to Supabase tables when we migrate off hardcoded data.
// Future tables: workouts, workout_exercises, exercise_sets

export type ExerciseSet = {
  reps: number
  weightLbs?: number // optional — bodyweight exercises omit this
}

/**
 * Structured variation tracking for bodyweight exercises.
 * grip  — how hands are positioned (Wide, Close, Neutral, Supinated…)
 * form  — body position / movement style (Decline, Diamond, Archer, Kipping…)
 * Both are free strings so you can add new ones without a schema change.
 */
export type ExerciseVariant = {
  grip?: string // e.g. "Wide", "Close", "Neutral", "Regular"
  form?: string // e.g. "Decline", "Diamond", "Archer", "Pike", "Dead Hang"
}

export type WorkoutExercise = {
  name: string
  variant?: ExerciseVariant // replaces flat subtype — grip + form tracked separately
  // Strength
  sets?: ExerciseSet[]
  // Cardio
  distanceMiles?: number
  durationMinutes?: number
}

export type WorkoutType = 'lift' | 'run' | 'bodyweight' | 'other'

export type Workout = {
  id: string
  date: string // "YYYY-MM-DD"
  type: WorkoutType
  bodyWeightLbs?: number
  exercises: WorkoutExercise[]
  notes?: string
}

export type PR = {
  exercise: string
  weightLbs: number
  reps: number
  date: string
}

/** Best single-set rep count for a bodyweight exercise+variant combo */
export type BodyweightPR = {
  exercise: string
  variant: ExerciseVariant
  maxReps: number
  date: string
}

export type BodyWeightEntry = {
  date: string
  weightLbs: number
}

export type Period = 'daily' | 'weekly' | 'monthly'

// ─── Push-up / Pull-up Config ─────────────────────────────────────────────
export const PUSH_UP_SUBTYPES = [
  'Regular',
  'Wide Grip',
  'Diamond',
  'Decline',
  'Archer',
] as const

export const PULL_UP_SUBTYPES = [
  'Regular',
  'Chin-up',
  'Wide Grip',
  'Close Grip',
  'Neutral Grip',
] as const

// Daily rep goals — add any exercise name here to show a progress bar
export const DAILY_GOALS: Record<string, number> = {
  'Push-up': 100,
  'Pull-up': 100,
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Best single-set rep count per exercise + variant (for bodyweight exercises) */
export function computeBodyweightPRs(workouts: Workout[]): BodyweightPR[] {
  const prMap: Record<string, BodyweightPR> = {}
  for (const workout of workouts) {
    for (const ex of workout.exercises) {
      if (!ex.sets || ex.sets.some(s => s.weightLbs)) continue // skip weighted
      const key = `${ex.name}|${ex.variant?.grip ?? ''}|${ex.variant?.form ?? ''}`
      for (const set of ex.sets) {
        const current = prMap[key]
        if (!current || set.reps > current.maxReps) {
          prMap[key] = {
            exercise: ex.name,
            variant: ex.variant ?? {},
            maxReps: set.reps,
            date: workout.date,
          }
        }
      }
    }
  }
  return Object.values(prMap).sort((a, b) => {
    if (a.exercise !== b.exercise) return a.exercise.localeCompare(b.exercise)
    return b.maxReps - a.maxReps
  })
}

/** Compute best weighted lift per exercise (ignores bodyweight sets) */
export function computePRs(workouts: Workout[]): PR[] {
  const prMap: Record<string, PR> = {}
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (!exercise.sets) continue
      for (const set of exercise.sets) {
        if (!set.weightLbs) continue // skip bodyweight
        const current = prMap[exercise.name]
        if (!current || set.weightLbs > current.weightLbs) {
          prMap[exercise.name] = {
            exercise: exercise.name,
            weightLbs: set.weightLbs,
            reps: set.reps,
            date: workout.date,
          }
        }
      }
    }
  }
  return Object.values(prMap).sort((a, b) => b.weightLbs - a.weightLbs)
}

/** Total reps done per exercise name on a given date (for daily goal tracking) */
export function getDailyRepTotals(workouts: Workout[], date: string): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const workout of workouts.filter(w => w.date === date)) {
    for (const ex of workout.exercises) {
      const reps = ex.sets?.reduce((sum, s) => sum + s.reps, 0) ?? 0
      totals[ex.name] = (totals[ex.name] ?? 0) + reps
    }
  }
  return totals
}

export function getBodyWeightEntries(workouts: Workout[]): BodyWeightEntry[] {
  const seen = new Set<string>()
  const entries: BodyWeightEntry[] = []
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    if (w.bodyWeightLbs && !seen.has(w.date)) {
      seen.add(w.date)
      entries.push({ date: w.date, weightLbs: w.bodyWeightLbs })
    }
  }
  return entries
}

export function getPeriodRange(period: Period, today = new Date().toISOString().slice(0, 10)) {
  const date = new Date(today + 'T12:00:00')
  if (period === 'daily') return { from: today, to: today }
  if (period === 'weekly') {
    const day = date.getDay()
    const mon = new Date(date)
    mon.setDate(date.getDate() - ((day + 6) % 7))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) }
  }
  const from = `${today.slice(0, 7)}-01`
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export function getWorkoutsForPeriod(workouts: Workout[], period: Period): Workout[] {
  const { from, to } = getPeriodRange(period)
  return workouts
    .filter(w => w.date >= from && w.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date))
}

// ─── Hardcoded Data ──────────────────────────────────────────────────────────
// TODO: replace with Supabase fetch when ready

export const WORKOUTS: Workout[] = [
  // ── 2026-03-15 (today) ──
  {
    id: 'w1',
    date: '2026-03-15',
    type: 'lift',
    bodyWeightLbs: 185,
    exercises: [
      {
        name: 'Squat',
        sets: [
          { reps: 5, weightLbs: 225 },
          { reps: 5, weightLbs: 245 },
          { reps: 3, weightLbs: 265 },
        ],
      },
      {
        name: 'Bench Press',
        sets: [
          { reps: 5, weightLbs: 185 },
          { reps: 5, weightLbs: 195 },
          { reps: 3, weightLbs: 205 },
        ],
      },
    ],
  },
  {
    id: 'w1b',
    date: '2026-03-15',
    type: 'bodyweight',
    exercises: [
      {
        name: 'Push-up',
        variant: { grip: 'Regular', form: 'Flat' },
        sets: [{ reps: 30 }, { reps: 25 }, { reps: 20 }],
      },
      {
        name: 'Push-up',
        variant: { grip: 'Wide', form: 'Flat' },
        sets: [{ reps: 15 }, { reps: 10 }],
      },
      {
        name: 'Pull-up',
        variant: { grip: 'Overhand', form: 'Dead Hang' },
        sets: [{ reps: 10 }, { reps: 8 }, { reps: 7 }],
      },
      {
        name: 'Pull-up',
        variant: { grip: 'Underhand', form: 'Dead Hang' },
        sets: [{ reps: 10 }, { reps: 8 }],
      },
    ],
  },

  // ── 2026-03-13 ──
  {
    id: 'w2',
    date: '2026-03-13',
    type: 'run',
    bodyWeightLbs: 185,
    exercises: [{ name: 'Run', distanceMiles: 3.1, durationMinutes: 28 }],
  },
  {
    id: 'w2b',
    date: '2026-03-13',
    type: 'bodyweight',
    exercises: [
      {
        name: 'Push-up',
        variant: { grip: 'Regular', form: 'Flat' },
        sets: [{ reps: 30 }, { reps: 25 }, { reps: 20 }, { reps: 15 }, { reps: 10 }],
      },
      {
        name: 'Push-up',
        variant: { grip: 'Close', form: 'Diamond' },
        sets: [{ reps: 20 }, { reps: 15 }, { reps: 10 }],
      },
      {
        name: 'Pull-up',
        variant: { grip: 'Wide', form: 'Dead Hang' },
        sets: [{ reps: 8 }, { reps: 7 }, { reps: 6 }],
      },
      {
        name: 'Pull-up',
        variant: { grip: 'Overhand', form: 'Dead Hang' },
        sets: [{ reps: 10 }, { reps: 9 }, { reps: 8 }, { reps: 7 }],
      },
      {
        name: 'Pull-up',
        variant: { grip: 'Underhand', form: 'Dead Hang' },
        sets: [{ reps: 12 }, { reps: 10 }, { reps: 8 }],
      },
    ],
  },

  // ── 2026-03-11 ──
  {
    id: 'w3',
    date: '2026-03-11',
    type: 'lift',
    bodyWeightLbs: 186,
    exercises: [
      {
        name: 'Squat',
        sets: [
          { reps: 5, weightLbs: 215 },
          { reps: 5, weightLbs: 225 },
          { reps: 5, weightLbs: 245 },
        ],
      },
      {
        name: 'Overhead Press',
        sets: [
          { reps: 5, weightLbs: 115 },
          { reps: 5, weightLbs: 120 },
          { reps: 3, weightLbs: 125 },
        ],
      },
    ],
  },
  {
    id: 'w3b',
    date: '2026-03-11',
    type: 'bodyweight',
    exercises: [
      {
        name: 'Push-up',
        variant: { grip: 'Regular', form: 'Flat' },
        sets: [{ reps: 25 }, { reps: 20 }, { reps: 15 }, { reps: 10 }],
      },
      {
        name: 'Push-up',
        variant: { grip: 'Regular', form: 'Decline' },
        sets: [{ reps: 15 }, { reps: 12 }, { reps: 10 }],
      },
      {
        name: 'Pull-up',
        variant: { grip: 'Overhand', form: 'Dead Hang' },
        sets: [{ reps: 10 }, { reps: 8 }, { reps: 7 }, { reps: 6 }],
      },
      {
        name: 'Pull-up',
        variant: { grip: 'Neutral', form: 'Dead Hang' },
        sets: [{ reps: 10 }, { reps: 9 }, { reps: 8 }],
      },
    ],
  },

  // ── 2026-03-08 ──
  {
    id: 'w4',
    date: '2026-03-08',
    type: 'lift',
    bodyWeightLbs: 187,
    exercises: [
      {
        name: 'Deadlift',
        sets: [
          { reps: 5, weightLbs: 295 },
          { reps: 3, weightLbs: 315 },
          { reps: 1, weightLbs: 335 },
        ],
      },
      {
        name: 'Bench Press',
        sets: [
          { reps: 5, weightLbs: 175 },
          { reps: 5, weightLbs: 185 },
          { reps: 5, weightLbs: 195 },
        ],
      },
    ],
  },

  // ── 2026-03-06 ──
  {
    id: 'w5',
    date: '2026-03-06',
    type: 'run',
    bodyWeightLbs: 187,
    exercises: [{ name: 'Run', distanceMiles: 2.5, durationMinutes: 23 }],
  },

  // ── 2026-03-04 ──
  {
    id: 'w6',
    date: '2026-03-04',
    type: 'lift',
    bodyWeightLbs: 188,
    exercises: [
      {
        name: 'Squat',
        sets: [
          { reps: 5, weightLbs: 205 },
          { reps: 5, weightLbs: 215 },
          { reps: 5, weightLbs: 225 },
        ],
      },
      {
        name: 'Overhead Press',
        sets: [
          { reps: 5, weightLbs: 110 },
          { reps: 5, weightLbs: 115 },
          { reps: 5, weightLbs: 120 },
        ],
      },
    ],
  },

  // ── 2026-02-28 ──
  {
    id: 'w7',
    date: '2026-02-28',
    type: 'lift',
    bodyWeightLbs: 189,
    exercises: [
      {
        name: 'Deadlift',
        sets: [
          { reps: 5, weightLbs: 285 },
          { reps: 3, weightLbs: 305 },
          { reps: 1, weightLbs: 325 },
        ],
      },
      {
        name: 'Bench Press',
        sets: [
          { reps: 5, weightLbs: 165 },
          { reps: 5, weightLbs: 175 },
          { reps: 5, weightLbs: 185 },
        ],
      },
    ],
  },

  // ── 2026-02-25 ──
  {
    id: 'w8',
    date: '2026-02-25',
    type: 'run',
    bodyWeightLbs: 190,
    exercises: [{ name: 'Run', distanceMiles: 3.5, durationMinutes: 32 }],
  },

  // ── 2026-02-22 ──
  {
    id: 'w9',
    date: '2026-02-22',
    type: 'lift',
    bodyWeightLbs: 190,
    exercises: [
      {
        name: 'Squat',
        sets: [
          { reps: 5, weightLbs: 195 },
          { reps: 5, weightLbs: 205 },
          { reps: 5, weightLbs: 215 },
        ],
      },
      {
        name: 'Deadlift',
        sets: [
          { reps: 5, weightLbs: 275 },
          { reps: 3, weightLbs: 295 },
          { reps: 1, weightLbs: 315 },
        ],
      },
    ],
  },
]
