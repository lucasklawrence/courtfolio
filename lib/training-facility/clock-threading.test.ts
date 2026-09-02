import { describe, expect, it } from 'vitest'

import type {
  ExerciseGoal,
  MonthlyFocus,
  StrengthSet,
  WeightRoomAchievement,
  WeightRoomWorkout,
} from '@/types/weight-room'

import { PACIFIC_CLOCK, createDayClock, type DayClock } from './clock'
import { buildAchievementBoard, resolveAchievements } from './achievements'
import {
  buildExerciseProgression,
  buildSetDetailCoverage,
  trendableExercises,
} from './exercise-progression'
import { buildMovementLoadView, buildMovementLoads } from './load-management'
import {
  buildFocusLaneCells,
  computeFocusAdherence,
  computeFocusLoadStats,
  summarizeFocusCampaigns,
} from './monthly-focus'
import { computeStrengthStreaks as computeGoalStreaks } from './strength-streaks'
import {
  filterSetsForDay,
  formatDayLabel,
  localNoonIsoForDay,
  toLocalDateKey,
} from './strength-today'
import { firstLoggedDate, heatmapWindow } from './heatmap-span'
import {
  buildStrengthHeatmap,
  buildWeeklyVolume,
  computeStrengthStats,
  computeStrengthStreaks,
} from './weight-room-history'
import { workoutDayKey } from './workout-sessions'
import { buildWorkoutHistory, workoutYear, workoutYearOptions } from './workout-stats'

/**
 * The gate for the `DayClock` refactor (#429).
 *
 * Threading a clock through ~25 functions has one failure mode, and it is
 * silent: a function accepts the parameter and forgets to hand it to a helper.
 * **Every other test in this repo still passes** when that happens, because
 * this repo is Pacific and the default is Pacific — so the mistake ships, and
 * surfaces months later in a consumer whose clients are somewhere else, as
 * off-by-one days in streaks and heatmaps.
 *
 * So each zone-consuming entry point runs twice over the same fixture — once in
 * Pacific, once in `Pacific/Kiritimati` (UTC+14, the furthest-forward zone
 * there is) — and the two results must **differ**. A dropped clock produces
 * byte-identical output and fails here.
 *
 * ## The fixture is the hard part
 *
 * Shifting every timestamp by 21 hours moves all the days together, and most
 * rollups are invariant under that — a streak of 1 is a streak of 1 whichever
 * zone you count it in. An assertion built on such a fixture would pass whether
 * or not the clock was honored, which is worse than no assertion.
 *
 * What actually discriminates is two sets on the **same Pacific day that fall
 * on different Kiritimati days**. Pacific 2026-07-14 runs 07:00Z→07:00Z, and
 * Kiritimati's midnight lands at 10:00Z inside it:
 *
 * - `08:00Z` → Pacific Jul 14 01:00 · Kiritimati Jul 14 22:00
 * - `12:00Z` → Pacific Jul 14 05:00 · Kiritimati Jul 15 02:00
 *
 * So Pacific sees one 120-rep day; Kiritimati sees two 60-rep days. That single
 * difference propagates into every daily rollup, every streak, and the
 * hundred-rep achievement. Week and year boundaries get the same treatment.
 *
 * When this file is copied into the shared package, keep it. It's the only test
 * here that can fail for the right reason.
 */

/** UTC+14 — the largest offset in the tz database, ~21h ahead of Pacific. */
const KIRITIMATI = createDayClock('Pacific/Kiritimati')

/** Pacific Jul 14 01:00 · Kiritimati Jul 14 22:00. */
const SPLIT_EARLY = '2026-07-14T08:00:00Z'
/** Pacific Jul 14 05:00 · Kiritimati Jul **15** 02:00 — the same Pacific day. */
const SPLIT_LATE = '2026-07-14T12:00:00Z'
/** Pacific Sun Jul 12 · Kiritimati Mon Jul 13 — different ISO weeks. */
const WEEK_STRADDLE = '2026-07-12T12:00:00Z'
/** Pacific Dec 31 2026 · Kiritimati Jan 1 2027. */
const YEAR_STRADDLE = '2026-12-31T12:00:00Z'
/**
 * Pacific Mar 3 2022 · Kiritimati Mar 4 2022 — and old enough to be outside
 * the heatmaps' default trailing-year window (#438).
 */
const ARCHIVE_STRADDLE = '2022-03-04T05:00:00Z'
/** "Now", late enough that every fixture day has elapsed in both zones. */
const NOW = new Date('2026-07-16T20:00:00Z')

const GOAL: ExerciseGoal = { exercise: 'pushups', daily_target: 50, color: '#EA580C' }

function set(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return { id: 'set-1', logged_at: SPLIT_EARLY, exercise: 'pushups', reps: 60, ...overrides }
}

function workout(overrides: Partial<WeightRoomWorkout> = {}): WeightRoomWorkout {
  return { id: 'w1', started_at: SPLIT_LATE, source: 'manual', ...overrides }
}

/** The discriminating pair, plus a weighted set on the late side. */
const SETS: StrengthSet[] = [
  set({ id: 's1', logged_at: SPLIT_EARLY, reps: 60 }),
  set({ id: 's2', logged_at: SPLIT_LATE, reps: 60 }),
  set({ id: 's3', logged_at: SPLIT_LATE, reps: 10, weight_lbs: 45 }),
]

/**
 * Eight distinct training days so the ramp panel's `MIN_TRAINING_DAYS_IN_WINDOW`
 * gate is cleared and `buildMovementLoadView` returns a card at all — plus the
 * split pair, which is what makes the two zones disagree.
 */
const FREQUENT_SETS: StrengthSet[] = [
  ...Array.from({ length: 8 }, (_, i) =>
    set({ id: `f${i}`, logged_at: `2026-07-0${i + 1}T20:00:00Z`, reps: 50 })
  ),
  ...SETS,
]

const FOCUS: MonthlyFocus = {
  id: 'f1',
  exercise: 'pushups',
  daily_target: 50,
  target_kind: 'reps',
  color: '#C9A268',
  category: 'upper',
  // Closes on the Pacific day the split pair lands on, so Kiritimati's later
  // half falls outside the window entirely.
  start_date: '2026-07-01',
  end_date: '2026-07-14',
}

/** 100 reps in a day — cleared by Pacific's merged 120, missed by Kiritimati's 60s. */
const LADDER: WeightRoomAchievement[] = [
  { id: 'a1', label: 'Century', exercise: 'pushups', scope: 'day', threshold: 100 },
]

/**
 * Assert an entry point actually consults the clock it was handed.
 *
 * @param run Called once per zone; whatever it returns is compared structurally.
 */
function dependsOnZone(run: (clock: DayClock) => unknown): void {
  expect(JSON.stringify(run(KIRITIMATI))).not.toBe(JSON.stringify(run(PACIFIC_CLOCK)))
}

describe('the fixture actually straddles a boundary', () => {
  it('splits one Pacific day across two Kiritimati days', () => {
    expect(PACIFIC_CLOCK.safeDayKey(SPLIT_EARLY)).toBe('2026-07-14')
    expect(PACIFIC_CLOCK.safeDayKey(SPLIT_LATE)).toBe('2026-07-14')
    expect(KIRITIMATI.safeDayKey(SPLIT_EARLY)).toBe('2026-07-14')
    expect(KIRITIMATI.safeDayKey(SPLIT_LATE)).toBe('2026-07-15')
  })

  it('splits an ISO week', () => {
    expect(PACIFIC_CLOCK.safeDayKey(WEEK_STRADDLE)).toBe('2026-07-12') // Sunday
    expect(KIRITIMATI.safeDayKey(WEEK_STRADDLE)).toBe('2026-07-13') // Monday
  })

  it('splits a calendar year', () => {
    expect(PACIFIC_CLOCK.safeDayKey(YEAR_STRADDLE)).toBe('2026-12-31')
    expect(KIRITIMATI.safeDayKey(YEAR_STRADDLE)).toBe('2027-01-01')
  })
})

describe('every zone-consuming entry point honors its clock', () => {
  it('workoutDayKey', () => {
    dependsOnZone(clock => workoutDayKey(workout(), clock))
  })

  it('toLocalDateKey', () => {
    dependsOnZone(clock => toLocalDateKey(SPLIT_LATE, clock))
  })

  it('filterSetsForDay', () => {
    dependsOnZone(clock => filterSetsForDay(SETS, '2026-07-14', clock).map(s => s.id))
  })

  it('localNoonIsoForDay', () => {
    dependsOnZone(clock => localNoonIsoForDay('2026-07-14', clock))
  })

  it('computeStrengthStreaks (per-goal)', () => {
    dependsOnZone(clock => computeGoalStreaks(SETS, [GOAL], NOW, clock))
  })

  it('computeStrengthStreaks (history)', () => {
    dependsOnZone(clock => computeStrengthStreaks(SETS, GOAL, NOW, clock))
  })

  it('buildStrengthHeatmap', () => {
    dependsOnZone(clock =>
      buildStrengthHeatmap(SETS, GOAL, new Date('2026-07-01T20:00:00Z'), NOW, clock)
        .grid.flat()
        .filter(cell => cell.reps > 0)
        .map(cell => `${cell.dayKey}:${cell.reps}`)
    )
  })

  it('heatmapWindow', () => {
    // The all-time start is a day bucket like any other (#438): read in the
    // wrong zone it lands a day early, and the grid's first column with it.
    //
    // Needs a set older than the default window, or `heatmapWindow` correctly
    // returns the component default for both zones and the comparison is
    // vacuous — the archive is the whole point of the branch under test.
    const archived = [...SETS, set({ id: 'archive', logged_at: ARCHIVE_STRADDLE, reps: 20 })]
    dependsOnZone(
      clock => heatmapWindow('all', archived, clock, NOW).dateFrom?.toISOString() ?? null
    )
  })

  it('firstLoggedDate', () => {
    dependsOnZone(clock => firstLoggedDate(SETS, clock)?.toISOString() ?? null)
  })

  it('computeStrengthStats', () => {
    dependsOnZone(clock => computeStrengthStats(SETS, [GOAL], NOW, [], clock))
  })

  it('buildWeeklyVolume', () => {
    const weekly = [...SETS, set({ id: 'wk', logged_at: WEEK_STRADDLE, reps: 33 })]
    dependsOnZone(clock =>
      buildWeeklyVolume(weekly, GOAL, 4, NOW, clock).map(p => `${p.weekKey}:${p.reps}`)
    )
  })

  it('buildMovementLoads', () => {
    dependsOnZone(clock => buildMovementLoads(SETS, [GOAL], NOW, [], clock).map(l => l.sparkline))
  })

  it('buildMovementLoadView', () => {
    dependsOnZone(clock =>
      buildMovementLoadView(FREQUENT_SETS, [GOAL], NOW, [], clock).loads.map(l => l.sparkline)
    )
  })

  it('resolveAchievements', () => {
    dependsOnZone(clock =>
      resolveAchievements(SETS, [GOAL], LADDER, [], clock).map(r => `${r.best}:${r.earned}`)
    )
  })

  it('buildAchievementBoard', () => {
    dependsOnZone(clock => buildAchievementBoard(SETS, [GOAL], LADDER, [], clock).earnedCount)
  })

  it('computeFocusAdherence', () => {
    // Adherence reports day *counts*, not volume, so the bar has to sit between
    // the merged Pacific day (60 + 10 = 70) and Kiritimati's leading half (60).
    // Pacific hits it, Kiritimati doesn't — one day hit versus none.
    const strictFocus: MonthlyFocus = { ...FOCUS, daily_target: 65 }
    dependsOnZone(clock => computeFocusAdherence(strictFocus, SETS, NOW, clock))
  })

  it('computeFocusLoadStats', () => {
    dependsOnZone(clock => computeFocusLoadStats(FOCUS, SETS, 1, clock))
  })

  it('buildFocusLaneCells', () => {
    dependsOnZone(clock =>
      buildFocusLaneCells([FOCUS], SETS, 'upper', '2026-07-14', clock).map(
        c => `${c.dayKey}:${c.volume}`
      )
    )
  })

  it('summarizeFocusCampaigns', () => {
    dependsOnZone(clock => summarizeFocusCampaigns([FOCUS], 'pushups', SETS, NOW, clock))
  })

  it('buildExerciseProgression', () => {
    dependsOnZone(clock =>
      buildExerciseProgression('pushups', SETS, [], [], clock)?.points.map(
        p => `${p.dayKey}:${p.reps}`
      )
    )
  })

  it('buildSetDetailCoverage', () => {
    // Pacific dates the import to 7/14, strictly before the 7/15 cutoff, so it
    // counts. Kiritimati dates it to 7/15, which is not before it.
    const imported = [workout({ id: 'imported', source: 'apple_health' })]
    dependsOnZone(clock => buildSetDetailCoverage('2026-07-15', imported, [], clock))
  })

  it('trendableExercises', () => {
    // Pacific has both last-trained on 7/14 — a tie, broken alphabetically.
    // Kiritimati puts squats a day later, so it sorts first. The returned
    // ordering itself flips.
    const mixed = [
      set({ id: 'a', exercise: 'pullups', logged_at: SPLIT_EARLY }),
      set({ id: 'b', exercise: 'squats', logged_at: SPLIT_LATE }),
    ]
    dependsOnZone(clock => trendableExercises(mixed, clock))
  })

  it('workoutYearOptions', () => {
    const entries = buildWorkoutHistory([workout({ started_at: YEAR_STRADDLE })], [])
    dependsOnZone(clock => workoutYearOptions(entries, clock))
  })

  it('workoutYear', () => {
    const [entry] = buildWorkoutHistory([workout({ started_at: YEAR_STRADDLE })], [])
    dependsOnZone(clock => workoutYear(entry, clock))
  })
})

describe('formatDayLabel is deliberately zone-stable', () => {
  it('names the same day in both zones, because that is the point', () => {
    // The label must agree with the key it came from *everywhere* — a Pacific
    // `2026-07-14` should not render as "Jul 15" for a reader in Kiritimati.
    // So unlike its neighbours, a difference here would be the bug.
    expect(formatDayLabel('2026-07-14', KIRITIMATI)).toBe(
      formatDayLabel('2026-07-14', PACIFIC_CLOCK)
    )
  })

  it('still resolves the zone underneath', () => {
    // Proof the clock isn't being ignored: ask for the zone name and the two
    // answers diverge, even though the calendar day does not.
    dependsOnZone(clock => clock.format('2026-07-14', { timeZoneName: 'short' }, 'en-US'))
  })
})

describe('the Pacific default is unchanged', () => {
  it('omitting the clock matches passing PACIFIC_CLOCK explicitly', () => {
    // The other half of the contract: courtfolio passes no clock anywhere, so
    // the default has to reproduce the old behavior exactly.
    expect(workoutDayKey(workout())).toBe(workoutDayKey(workout(), PACIFIC_CLOCK))
    expect(toLocalDateKey(SPLIT_LATE)).toBe(toLocalDateKey(SPLIT_LATE, PACIFIC_CLOCK))
    expect(formatDayLabel('2026-07-14')).toBe(formatDayLabel('2026-07-14', PACIFIC_CLOCK))
    expect(JSON.stringify(computeStrengthStats(SETS, [GOAL], NOW))).toBe(
      JSON.stringify(computeStrengthStats(SETS, [GOAL], NOW, [], PACIFIC_CLOCK))
    )
    expect(JSON.stringify(buildExerciseProgression('pushups', SETS))).toBe(
      JSON.stringify(buildExerciseProgression('pushups', SETS, [], [], PACIFIC_CLOCK))
    )
    expect(JSON.stringify(buildAchievementBoard(SETS, [GOAL], LADDER))).toBe(
      JSON.stringify(buildAchievementBoard(SETS, [GOAL], LADDER, [], PACIFIC_CLOCK))
    )
  })
})
