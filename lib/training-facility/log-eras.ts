/**
 * Whole-log era comparison (#437).
 *
 * #400 shipped a then-vs-now panel, but only per movement, and only for the six
 * that span both stretches. Everything else in the archive — 42 movements the
 * current log has never touched — had no comparative surface at all, and the
 * per-movement view can't answer the more interesting question anyway: not "is
 * my bench better", but "what did training *look like* then versus now".
 *
 * The two stretches differ in kind, not just amount. The archive is a
 * six-template gym rotation, barbell-heavy, recorded set by set; the current log
 * is mostly grease-the-groove bodyweight work. So this module deliberately
 * reports each era's shape *side by side* and never subtracts one from the
 * other: "volume is down" would be a lie assembled from barbell tonnage on one
 * side and push-up reps on the other.
 */
import type { StrengthSet, WeightRoomExercise } from '@/types/weight-room'

import { PACIFIC_CLOCK, type DayClock } from './clock'
import { DEFAULT_MIN_GAP_DAYS, daysBetween } from './era-comparison'
import { countedReps } from './set-reps'
import { effectiveSetLoad, loadMultipliersBySlug } from './workout-stats'

/** One stretch of training, described on its own terms. */
export interface LogEra {
  /** First training day, `YYYY-MM-DD`. */
  startDayKey: string
  /** Last training day, `YYYY-MM-DD`. */
  endDayKey: string
  /** Days on which anything was logged. Not the calendar span. */
  trainingDays: number
  /** Sets logged. */
  sets: number
  /** Reps logged. */
  reps: number
  /** Sets carrying an external load. */
  loadedSets: number
  /**
   * Share of sets carrying an external load, `0`–`1`. The clearest single read
   * on the change in *kind*: the archive sits near half, the current log near a
   * seventh.
   */
  loadedShare: number
  /** Distinct movements trained. */
  movements: number
}

/** One month of the log, for the cadence series. */
export interface EraMonth {
  /** `YYYY-MM`. */
  monthKey: string
  /** Days trained in the month. */
  trainingDays: number
  /** Which stretch it belongs to — `'gap'` for the layoff between them. */
  era: 'then' | 'gap' | 'now'
}

/** Which movements each era did and didn't have. */
export interface MovementRoster {
  /** Trained in the earlier era only, alphabetical. */
  thenOnly: string[]
  /** Trained in both. */
  shared: string[]
  /** Trained in the later era only. */
  nowOnly: string[]
}

/** The whole log, split in two. */
export interface LogEras {
  /** The earlier stretch. */
  then: LogEra
  /** The later stretch. */
  now: LogEra
  /** Calendar days between the last day of {@link then} and the first of {@link now}. */
  gapDays: number
  /**
   * Every month from the log's first to its last, contiguous — including the
   * empty ones. The layoff is ~25 months, and a series that simply omits them
   * draws the two eras adjacent, which is the one thing this view must not do.
   */
  months: EraMonth[]
  /** Movement overlap between the eras. */
  roster: MovementRoster
}

/**
 * Split the whole log at its longest layoff and describe each side.
 *
 * The split is the *training* gap rather than the row's `source`, which matters
 * for the same reason #400's per-movement panel uses it: source records how the
 * data arrived, not when the training happened, so a future import of older
 * sessions would silently land on the wrong side of a source-based boundary.
 * On today's data the two coincide exactly — the longest gap is 767 days, and
 * the next is 101, well inside the threshold.
 *
 * @param sets Every logged set.
 * @param exercises Movement roster, for the load multipliers that decide
 *   whether a set counts as loaded.
 * @param minGapDays Layoff that separates two eras; defaults to
 *   {@link DEFAULT_MIN_GAP_DAYS}.
 * @param clock Zone each day is measured in; defaults to Pacific (#429).
 * @returns The two eras, or `null` when the log has no layoff long enough to
 *   split on — one continuous stretch has no "then" to compare against, and
 *   inventing a boundary would manufacture the comparison.
 */
export function buildLogEras(
  sets: readonly StrengthSet[],
  exercises: readonly WeightRoomExercise[] = [],
  minGapDays: number = DEFAULT_MIN_GAP_DAYS,
  clock: DayClock = PACIFIC_CLOCK
): LogEras | null {
  const byDay = new Map<string, StrengthSet[]>()
  for (const set of sets) {
    const dayKey = clock.safeDayKey(set.logged_at)
    if (dayKey === '') continue
    const existing = byDay.get(dayKey)
    if (existing === undefined) byDay.set(dayKey, [set])
    else existing.push(set)
  }

  const dayKeys = [...byDay.keys()].sort()
  if (dayKeys.length === 0) return null

  // The *longest* layoff, not the first over the threshold: a log with two long
  // breaks should split at the one that actually separates its eras.
  let splitIndex = -1
  let longest = 0
  for (let i = 1; i < dayKeys.length; i++) {
    const gap = daysBetween(dayKeys[i - 1], dayKeys[i])
    if (gap >= minGapDays && gap > longest) {
      longest = gap
      splitIndex = i
    }
  }
  if (splitIndex === -1) return null

  const multipliers = loadMultipliersBySlug(exercises)
  const thenDays = dayKeys.slice(0, splitIndex)
  const nowDays = dayKeys.slice(splitIndex)

  return {
    then: describeEra(thenDays, byDay, multipliers),
    now: describeEra(nowDays, byDay, multipliers),
    gapDays: longest,
    months: buildMonths(dayKeys, splitIndex, byDay),
    roster: buildRoster(thenDays, nowDays, byDay),
  }
}

/** Summarize one contiguous run of training days. */
function describeEra(
  dayKeys: readonly string[],
  byDay: ReadonlyMap<string, StrengthSet[]>,
  multipliers: ReadonlyMap<string, number>
): LogEra {
  let setCount = 0
  let reps = 0
  let loadedSets = 0
  const movements = new Set<string>()

  for (const dayKey of dayKeys) {
    for (const set of byDay.get(dayKey) ?? []) {
      setCount += 1
      reps += countedReps(set)
      movements.add(set.exercise)
      // "Loaded" means the set carried external weight at all — a weighted
      // pushup counts, because it is loaded work. The multiplier scales
      // per-implement weight into pounds actually moved; it is an implement
      // count, not a bodyweight flag, so it never changes whether a set
      // qualifies, only by how much.
      if (effectiveSetLoad(set, multipliers) > 0) loadedSets += 1
    }
  }

  return {
    startDayKey: dayKeys[0] ?? '',
    endDayKey: dayKeys[dayKeys.length - 1] ?? '',
    trainingDays: dayKeys.length,
    sets: setCount,
    reps,
    loadedSets,
    loadedShare: setCount === 0 ? 0 : loadedSets / setCount,
    movements: movements.size,
  }
}

/**
 * Every month between the log's first and last, with the empty ones present.
 *
 * Walking the calendar rather than the data is the whole point: months with no
 * training have to occupy space, or the layoff disappears and the two eras
 * render adjacent.
 */
function buildMonths(
  dayKeys: readonly string[],
  splitIndex: number,
  byDay: ReadonlyMap<string, StrengthSet[]>
): EraMonth[] {
  const lastThenDay = dayKeys[splitIndex - 1]
  const firstNowDay = dayKeys[splitIndex]

  const trained = new Map<string, number>()
  for (const dayKey of dayKeys) {
    if ((byDay.get(dayKey)?.length ?? 0) === 0) continue
    const monthKey = dayKey.slice(0, 7)
    trained.set(monthKey, (trained.get(monthKey) ?? 0) + 1)
  }

  const months: EraMonth[] = []
  let cursor = dayKeys[0].slice(0, 7)
  const finalMonth = dayKeys[dayKeys.length - 1].slice(0, 7)
  while (cursor <= finalMonth) {
    months.push({
      monthKey: cursor,
      trainingDays: trained.get(cursor) ?? 0,
      era:
        cursor <= lastThenDay.slice(0, 7)
          ? 'then'
          : cursor >= firstNowDay.slice(0, 7)
            ? 'now'
            : 'gap',
    })
    cursor = nextMonth(cursor)
  }
  return months
}

/** The `YYYY-MM` after this one. */
function nextMonth(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4))
  const month = Number(monthKey.slice(5, 7))
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`
}

/** Which movements belong to which era. */
function buildRoster(
  thenDays: readonly string[],
  nowDays: readonly string[],
  byDay: ReadonlyMap<string, StrengthSet[]>
): MovementRoster {
  const collect = (dayKeys: readonly string[]): Set<string> => {
    const found = new Set<string>()
    for (const dayKey of dayKeys) {
      for (const set of byDay.get(dayKey) ?? []) found.add(set.exercise)
    }
    return found
  }

  const thenSet = collect(thenDays)
  const nowSet = collect(nowDays)
  return {
    thenOnly: [...thenSet].filter(slug => !nowSet.has(slug)).sort(),
    shared: [...thenSet].filter(slug => nowSet.has(slug)).sort(),
    nowOnly: [...nowSet].filter(slug => !thenSet.has(slug)).sort(),
  }
}
