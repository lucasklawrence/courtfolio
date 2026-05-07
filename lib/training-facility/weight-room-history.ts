import type { ExerciseGoal, StrengthSet } from '@/types/weight-room'

/**
 * Pure helpers for the Weight Room History View (#81). Mirrors the
 * cardio-side `heatmap-grid.ts` + `streaks.ts` split: this module owns
 * the per-exercise daily aggregation, the goal-relative intensity
 * bucketing, the streak rule (consecutive days hitting the daily goal),
 * and the period rollups (week / month / all-time) that the stats
 * panel reads.
 *
 * Strength sets carry an ISO `logged_at` timestamp; heatmap and stats
 * both bucket by *local* calendar day so a set logged at 11pm doesn't
 * silently roll into the next day.
 */

/** A single cell in the strength heatmap grid for one exercise. */
export interface StrengthHeatmapCell {
  /** Local-time date this cell represents. */
  date: Date
  /** Sum of reps logged for this exercise on {@link date}. `0` for empty days. */
  reps: number
  /** Number of distinct sets logged on {@link date}. */
  setCount: number
  /**
   * `reps / dailyTarget` — un-clamped, so 100% means "exactly hit the
   * goal" and 1.5 means "150% of goal". Empty days are `0`.
   */
  pct: number
}

/** Result of {@link buildStrengthHeatmap}. */
export interface StrengthHeatmapGrid {
  /** 7-row × N-column grid; row 0 is Monday, row 6 is Sunday. */
  grid: StrengthHeatmapCell[][]
  /** First-of-month markers for the column header labels. */
  monthLabels: { col: number; label: string }[]
}

/** Per-exercise rollups for the stats panel. */
export interface StrengthExerciseStats {
  /** Exercise name (matches {@link ExerciseGoal.exercise}). */
  exercise: string
  /** Hex color from the matching {@link ExerciseGoal.color}. */
  color: string
  /** Daily target reps from the matching goal. */
  dailyTarget: number
  /** Consecutive days (ending today or yesterday) hitting the daily target. */
  currentStreak: number
  /** Longest run of consecutive days hitting the daily target, all-time. */
  longestStreak: number
  /** Total reps logged this ISO week (Mon–Sun, current). */
  thisWeekReps: number
  /** Total reps logged last ISO week (Mon–Sun, previous). */
  lastWeekReps: number
  /** Total reps logged in the current calendar month. */
  thisMonthReps: number
  /** Total reps logged in the previous calendar month. */
  lastMonthReps: number
  /**
   * Mean sets per *active* day (a day with at least one set) over the
   * whole logged history. `0` when no sets exist for this exercise.
   * Active-day denominator (rather than calendar days since first set)
   * answers "when I train, how many sets do I do" — the question the
   * Today View's quick-log most directly relates to.
   */
  avgSetsPerActiveDay: number
  /** All-time total reps for this exercise. */
  allTimeReps: number
}

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
/** Cap at ~2 years to limit DOM node count when a wide range is requested. */
const MAX_COLS = 104

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Get the Monday at or before a given local date (00:00 local). */
function getMondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = m.getDay()
  m.setDate(m.getDate() - (dow === 0 ? 6 : dow - 1))
  return m
}

/** Get a `YYYY-MM-DD` local-date key from a Date. */
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Add `n` days to a `YYYY-MM-DD` key, returning a new key. Uses
 * local-noon as the base so DST transitions don't shift the date.
 */
function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/**
 * Bucket reps-as-percent-of-goal into one of four intensity levels for
 * the heatmap cell color: 0 = empty, 1 = light (1–49%), 2 = medium
 * (50–99%), 3 = full (100%+). Matches the four-band scheme called out
 * in the issue body.
 */
export function intensityFromPct(pct: number): 0 | 1 | 2 | 3 {
  if (pct <= 0) return 0
  if (pct < 0.5) return 1
  if (pct < 1) return 2
  return 3
}

/**
 * Aggregate one exercise's sets into a 7-row × N-column heatmap. Row 0
 * is Monday so a year reads top-down as Mon→Sun. The grid spans the
 * supplied range when both `dateFrom` and `dateTo` are provided;
 * otherwise it falls back to the trailing 52 weeks ending at the
 * current week. Capped at ~2 years to keep the DOM small.
 *
 * Each cell carries the day's rep total, set count, and `pct = reps /
 * dailyTarget` so the renderer can pick a color via
 * {@link intensityFromPct} and a tooltip can read "32 reps (3 sets,
 * 32% of goal)".
 *
 * Sets whose `exercise` doesn't match `goal.exercise` are silently
 * ignored — call once per exercise.
 *
 * @param sets every logged set from {@link import('@/types/weight-room').WeightRoomData.sets};
 *   the helper filters to the matching exercise.
 * @param goal the {@link ExerciseGoal} for the target exercise; supplies
 *   the `daily_target` denominator for `pct`.
 * @param dateFrom optional inclusive start of the range; clamped to ~2
 *   years before `dateTo` if longer.
 * @param dateTo optional inclusive end; defaults to today.
 */
export function buildStrengthHeatmap(
  sets: readonly StrengthSet[],
  goal: ExerciseGoal,
  dateFrom?: Date | null,
  dateTo?: Date | null,
): StrengthHeatmapGrid {
  const endMonday = getMondayOf(dateTo ?? new Date())
  const endDate = new Date(endMonday.getTime() + 6 * DAY_MS)

  let startMonday: Date
  if (dateFrom) {
    startMonday = getMondayOf(dateFrom)
    const maxStart = new Date(endMonday.getTime() - MAX_COLS * WEEK_MS)
    if (startMonday.getTime() < maxStart.getTime()) {
      startMonday = maxStart
    }
  } else {
    startMonday = new Date(endMonday.getTime() - 52 * WEEK_MS)
  }

  // Lookup: local-date key → { reps, setCount } for the matching exercise.
  const lookup = new Map<string, { reps: number; setCount: number }>()
  for (const s of sets) {
    if (s.exercise !== goal.exercise) continue
    const d = new Date(s.logged_at)
    if (!Number.isFinite(d.getTime())) continue
    const key = toDateKey(d)
    const entry = lookup.get(key)
    if (entry) {
      entry.reps += s.reps
      entry.setCount += 1
    } else {
      lookup.set(key, { reps: s.reps, setCount: 1 })
    }
  }

  // Belt-and-suspenders: the schema (`WeightRoomGoalRowSchema`) already
  // enforces a positive integer, but a 0/negative target slipping
  // through would divide-by-zero or invert the intensity bucket.
  const target = Math.max(1, goal.daily_target)
  const startMs = startMonday.getTime()
  const totalCols = Math.floor((endDate.getTime() - startMs) / WEEK_MS) + 1
  const grid: StrengthHeatmapCell[][] = Array.from({ length: 7 }, () => [])
  const monthLabels: { col: number; label: string }[] = []
  let lastMonth = -1

  for (let col = 0; col < totalCols; col++) {
    for (let row = 0; row < 7; row++) {
      const date = new Date(startMs + (col * 7 + row) * DAY_MS)
      const key = toDateKey(date)
      const entry = lookup.get(key)
      const reps = entry?.reps ?? 0
      grid[row].push({
        date,
        reps,
        setCount: entry?.setCount ?? 0,
        pct: reps / target,
      })

      if (date.getMonth() !== lastMonth) {
        lastMonth = date.getMonth()
        monthLabels.push({ col, label: MONTH_LABELS[date.getMonth()] })
      }
    }
  }

  return { grid, monthLabels }
}

/**
 * Compute the "hit-the-goal" streak for one exercise: consecutive
 * calendar days where the exercise's daily rep total met or exceeded
 * its `daily_target`. Days below the target — even ones with reps
 * logged — break the streak. Mirrors the issue body: "consecutive days
 * hitting goal".
 *
 * `current` counts back from today (or yesterday, if today hasn't
 * crossed the target yet) and is `0` when the most recent goal-hit day
 * is older than yesterday. `longest` is the all-time best.
 *
 * @param sets every logged set; filtered to `goal.exercise` internally.
 * @param goal the {@link ExerciseGoal} whose `daily_target` defines the
 *   bar to clear.
 * @param now optional override for the "today" anchor used to decide
 *   whether `current` includes the most recent hit-day. Defaults to
 *   `new Date()`. Threaded through from {@link computeStrengthStats}
 *   so a single fixed clock drives every rollup in one stats payload.
 */
export function computeStrengthStreaks(
  sets: readonly StrengthSet[],
  goal: ExerciseGoal,
  now: Date = new Date(),
): { current: number; longest: number } {
  // Belt-and-suspenders — same reason as in `buildStrengthHeatmap`.
  const target = Math.max(1, goal.daily_target)
  const dailyReps = new Map<string, number>()
  for (const s of sets) {
    if (s.exercise !== goal.exercise) continue
    const d = new Date(s.logged_at)
    if (!Number.isFinite(d.getTime())) continue
    const key = toDateKey(d)
    dailyReps.set(key, (dailyReps.get(key) ?? 0) + s.reps)
  }

  const hitDays: string[] = []
  for (const [key, reps] of dailyReps) {
    if (reps >= target) hitDays.push(key)
  }
  if (hitDays.length === 0) return { current: 0, longest: 0 }
  hitDays.sort()

  let longest = 1
  let run = 1
  for (let i = 1; i < hitDays.length; i++) {
    if (addDays(hitDays[i - 1], 1) === hitDays[i]) {
      run++
      if (run > longest) longest = run
    } else {
      run = 1
    }
  }

  const today = toDateKey(now)
  const yesterday = addDays(today, -1)
  const lastDay = hitDays[hitDays.length - 1]
  if (lastDay !== today && lastDay !== yesterday) {
    return { current: 0, longest }
  }

  let current = 1
  for (let i = hitDays.length - 2; i >= 0; i--) {
    if (addDays(hitDays[i], 1) === hitDays[i + 1]) {
      current++
    } else {
      break
    }
  }

  return { current, longest: Math.max(longest, current) }
}

/**
 * Sum reps for one exercise across an inclusive local-date window.
 * Both bounds are date-only — the function compares against each set's
 * local calendar day, so passing `[Apr 1, Apr 7]` totals everything
 * logged on Mon–Sun of that week regardless of the time of day.
 */
function sumRepsInRange(
  sets: readonly StrengthSet[],
  exercise: string,
  fromKey: string,
  toKey: string,
): number {
  let total = 0
  for (const s of sets) {
    if (s.exercise !== exercise) continue
    const d = new Date(s.logged_at)
    if (!Number.isFinite(d.getTime())) continue
    const key = toDateKey(d)
    if (key >= fromKey && key <= toKey) total += s.reps
  }
  return total
}

/**
 * Compute every per-exercise rollup the History stats panel needs:
 * streaks, this/last week reps, this/last month reps, average sets per
 * active day, and all-time reps. One {@link StrengthExerciseStats}
 * entry per goal, in the same order as `goals`.
 *
 * Week boundaries are ISO (Mon–Sun) so the rollup matches the heatmap's
 * row layout. Month boundaries are local calendar months. "Average
 * sets per active day" divides total sets by the number of distinct
 * days the exercise was performed — a day with multiple sets counts
 * once in the denominator.
 *
 * @param sets every logged set across all exercises.
 * @param goals the configured exercises; one stats entry per goal.
 * @param now optional override for the "today" anchor used by the week
 *   / month / streak math. Defaults to `new Date()`. Tests pass a
 *   fixed date to make week boundaries deterministic.
 */
export function computeStrengthStats(
  sets: readonly StrengthSet[],
  goals: readonly ExerciseGoal[],
  now: Date = new Date(),
): StrengthExerciseStats[] {
  const todayMonday = getMondayOf(now)
  const thisWeekStart = toDateKey(todayMonday)
  const thisWeekEnd = toDateKey(new Date(todayMonday.getTime() + 6 * DAY_MS))
  const lastWeekStart = toDateKey(new Date(todayMonday.getTime() - 7 * DAY_MS))
  const lastWeekEnd = toDateKey(new Date(todayMonday.getTime() - DAY_MS))

  const thisMonthStart = toDateKey(new Date(now.getFullYear(), now.getMonth(), 1))
  const thisMonthEnd = toDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  const lastMonthStart = toDateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const lastMonthEnd = toDateKey(new Date(now.getFullYear(), now.getMonth(), 0))

  return goals.map((goal) => {
    const matching = sets.filter((s) => s.exercise === goal.exercise)
    const activeDays = new Set<string>()
    let allTimeReps = 0
    let validSetCount = 0
    for (const s of matching) {
      const d = new Date(s.logged_at)
      if (!Number.isFinite(d.getTime())) continue
      activeDays.add(toDateKey(d))
      allTimeReps += s.reps
      validSetCount += 1
    }
    const avgSetsPerActiveDay = activeDays.size === 0 ? 0 : validSetCount / activeDays.size

    const streak = computeStrengthStreaks(sets, goal, now)
    return {
      exercise: goal.exercise,
      color: goal.color,
      dailyTarget: goal.daily_target,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      thisWeekReps: sumRepsInRange(sets, goal.exercise, thisWeekStart, thisWeekEnd),
      lastWeekReps: sumRepsInRange(sets, goal.exercise, lastWeekStart, lastWeekEnd),
      thisMonthReps: sumRepsInRange(sets, goal.exercise, thisMonthStart, thisMonthEnd),
      lastMonthReps: sumRepsInRange(sets, goal.exercise, lastMonthStart, lastMonthEnd),
      avgSetsPerActiveDay,
      allTimeReps,
    }
  })
}
