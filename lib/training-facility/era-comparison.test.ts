/**
 * Tests for then-vs-now era comparison (#400 phase 2).
 *
 * The cases pin the two ways this misleads: splitting somewhere other than the
 * real break in the history, and reporting a confident "no change" over a
 * movement that was never loaded in the first place.
 */
import { describe, expect, it } from 'vitest'

import type { StrengthSet } from '@/types/weight-room'

import {
  buildEraComparison,
  DEFAULT_CURRENT_WITHIN_DAYS,
  DEFAULT_MIN_GAP_DAYS,
  daysBetween,
  eraIsImported,
  isCurrentEra,
  latestLoggedDay,
  median,
  type TrainingEra,
} from './era-comparison'
import type { ExerciseDayPoint, ExerciseProgression } from './exercise-progression'
import type { WorkoutSetHighlight } from './workout-stats'

/** A day's top set at a given load. */
function highlight(effectiveLoad: number, reps = 8): WorkoutSetHighlight {
  return {
    setId: `set-${effectiveLoad}-${reps}`,
    reps,
    weightLbs: effectiveLoad,
    effectiveLoad,
    loggedAt: '2024-01-01T00:00:00Z',
  }
}

/** One training day. `load` of 0 means the day was bodyweight-only. */
function day(dayKey: string, load: number, reps = 8): ExerciseDayPoint {
  const top = load > 0 ? highlight(load, reps) : null
  return {
    dayKey,
    date: new Date(`${dayKey}T12:00:00Z`),
    sets: 1,
    reps,
    tonnage: load * reps,
    topSet: top,
    bestRepSet: top ?? highlight(0, reps),
    estimatedOneRepMax: load > 0 ? Math.round(load * (1 + reps / 30)) : null,
  }
}

/** A progression built from the given days. */
function progression(points: ExerciseDayPoint[]): ExerciseProgression {
  return {
    exercise: 'barbell-bench-press',
    points,
    isBodyweight: points.every(p => p.topSet === null),
    totalSets: points.length,
    totalReps: points.reduce((sum, p) => sum + p.reps, 0),
    loadedSets: points.filter(p => p.topSet !== null).length,
    highRepLoadedSets: 0,
    heaviestSet: null,
    mostRepsSet: highlight(0),
    bestOneRepMax: null,
  }
}

describe('daysBetween', () => {
  it('counts whole days', () => {
    expect(daysBetween('2024-04-16', '2024-04-18')).toBe(2)
  })

  it('is unaffected by a daylight-saving boundary', () => {
    // Spring forward in America/Los_Angeles was 2024-03-10. Measured in a local
    // zone this stretch would come out a day short.
    expect(daysBetween('2024-03-09', '2024-03-11')).toBe(2)
  })

  it('is NaN for an unparseable key', () => {
    expect(daysBetween('nope', '2024-04-18')).toBeNaN()
  })
})

describe('median', () => {
  it('takes the middle of an odd list', () => {
    expect(median([100, 135, 115])).toBe(115)
  })

  it('averages the two middles of an even list', () => {
    expect(median([100, 110, 120, 130])).toBe(115)
  })

  it('is null for an empty list', () => {
    expect(median([])).toBeNull()
  })

  it('does not mutate its input', () => {
    const values = [3, 1, 2]
    median(values)
    expect(values).toEqual([3, 1, 2])
  })
})

describe('buildEraComparison', () => {
  // The real shape this was built for: an archive that ends when the
  // note-taking stopped, and a current log that resumes two years later.
  const archiveThenNow = progression([
    day('2024-01-10', 135),
    day('2024-02-14', 145),
    day('2024-04-16', 155),
    day('2026-05-20', 165),
    day('2026-06-24', 185),
  ])

  it('splits at the long silence and summarizes both sides', () => {
    const comparison = buildEraComparison(archiveThenNow)
    expect(comparison).not.toBeNull()
    expect(comparison?.then.startDayKey).toBe('2024-01-10')
    expect(comparison?.then.endDayKey).toBe('2024-04-16')
    expect(comparison?.then.trainingDays).toBe(3)
    expect(comparison?.now.startDayKey).toBe('2026-05-20')
    expect(comparison?.now.endDayKey).toBe('2026-06-24')
    expect(comparison?.now.trainingDays).toBe(2)
    expect(comparison?.gapDays).toBe(daysBetween('2024-04-16', '2026-05-20'))
  })

  it('reports what changed across the gap', () => {
    const comparison = buildEraComparison(archiveThenNow)
    expect(comparison?.then.heaviestSet?.effectiveLoad).toBe(155)
    expect(comparison?.now.heaviestSet?.effectiveLoad).toBe(185)
    expect(comparison?.heaviestDelta).toBe(30)
    expect(comparison?.surpassedHeaviest).toBe(true)
  })

  it('uses the median daily top for the typical working load, not the mean', () => {
    // One heavy single in an otherwise light era would drag a mean up and
    // overstate what the training actually looked like.
    const spiky = progression([
      day('2024-01-10', 100),
      day('2024-02-14', 100),
      day('2024-03-14', 300),
      day('2026-05-20', 150),
      day('2026-06-24', 150),
    ])
    expect(buildEraComparison(spiky)?.then.typicalTopSet).toBe(100)
  })

  it('splits at the longest silence, not the first one over the threshold', () => {
    // Two qualifying gaps. Taking the first would make the answer depend on
    // scan order rather than on the real break in the history.
    const twoGaps = progression([
      day('2022-01-10', 95),
      day('2022-09-10', 105), // ~243-day gap
      day('2026-05-20', 165), // ~1348-day gap — the real break
      day('2026-06-24', 185),
    ])
    const comparison = buildEraComparison(twoGaps)
    expect(comparison?.then.endDayKey).toBe('2022-09-10')
    expect(comparison?.now.startDayKey).toBe('2026-05-20')
    expect(comparison?.then.trainingDays).toBe(2)
  })

  it('returns null for continuously trained movements', () => {
    const continuous = progression([
      day('2026-05-20', 135),
      day('2026-06-24', 145),
      day('2026-07-24', 155),
    ])
    expect(buildEraComparison(continuous)).toBeNull()
  })

  it('returns null when there is only one training day', () => {
    expect(buildEraComparison(progression([day('2026-05-20', 135)]))).toBeNull()
  })

  it('respects a custom gap threshold', () => {
    const shortLayoff = progression([day('2026-01-10', 135), day('2026-04-10', 145)])
    expect(buildEraComparison(shortLayoff)).toBeNull()
    expect(buildEraComparison(shortLayoff, 30)).not.toBeNull()
    expect(DEFAULT_MIN_GAP_DAYS).toBeGreaterThan(90)
  })

  it('states absence rather than a verdict for a bodyweight movement', () => {
    // "Not yet surpassed" would read as a judgement on training that was never
    // being measured in pounds.
    const bodyweight = progression([
      day('2024-01-10', 0, 12),
      day('2024-04-16', 0, 14),
      day('2026-05-20', 0, 18),
    ])
    const comparison = buildEraComparison(bodyweight)
    expect(comparison).not.toBeNull()
    expect(comparison?.heaviestDelta).toBeNull()
    expect(comparison?.surpassedHeaviest).toBeNull()
    expect(comparison?.then.typicalTopSet).toBeNull()
    // Rep volume still compares, which is the whole point for bodyweight work.
    expect(comparison?.now.reps).toBe(18)
  })

  it('does not claim a gain when only the current era is loaded', () => {
    const nowLoadedOnly = progression([
      day('2024-01-10', 0, 10),
      day('2024-04-16', 0, 10),
      day('2026-05-20', 135),
    ])
    const comparison = buildEraComparison(nowLoadedOnly)
    expect(comparison?.heaviestDelta).toBeNull()
    expect(comparison?.surpassedHeaviest).toBeNull()
    expect(comparison?.now.heaviestSet?.effectiveLoad).toBe(135)
  })

  it('reports a dead heat as neither surpassed nor behind', () => {
    // heaviestDelta of 0 renders as "by 0 lb" under either phrasing, so the
    // render site needs to be able to tell a tie from a gain.
    const tied = progression([
      day('2024-01-10', 135),
      day('2024-04-16', 135),
      day('2026-05-20', 135),
    ])
    const comparison = buildEraComparison(tied)
    expect(comparison?.heaviestDelta).toBe(0)
    expect(comparison?.surpassedHeaviest).toBe(false)
  })
})

describe('latestLoggedDay', () => {
  /** A set on a given day, at midday Pacific so the UTC instant stays on it. */
  function loggedOn(dayKey: string): StrengthSet {
    return { id: dayKey, logged_at: `${dayKey}T20:00:00Z`, exercise: 'pullups', reps: 5 }
  }

  it('finds the most recent day across every movement', () => {
    expect(
      latestLoggedDay([loggedOn('2024-04-16'), loggedOn('2026-08-09'), loggedOn('2023-01-08')])
    ).toBe('2026-08-09')
  })

  it('is empty for an empty log', () => {
    expect(latestLoggedDay([])).toBe('')
  })
})

describe('isCurrentEra', () => {
  /** An era ending on the given day; the rest is irrelevant here. */
  function eraEnding(endDayKey: string): TrainingEra {
    return {
      startDayKey: '2023-01-01',
      endDayKey,
      trainingDays: 1,
      sets: 1,
      reps: 1,
      tonnage: 0,
      heaviestSet: null,
      bestOneRepMax: null,
      typicalTopSet: null,
    }
  }

  it('is true when the era reaches the end of the log', () => {
    expect(isCurrentEra(eraEnding('2026-08-09'), '2026-08-09')).toBe(true)
  })

  it('is true for a movement trained recently but not last', () => {
    // Trained three weeks before the newest entry anywhere — still current.
    expect(isCurrentEra(eraEnding('2026-07-19'), '2026-08-09')).toBe(true)
  })

  it('is false for a movement that stopped two years ago', () => {
    // The real case: barbell and machine work ended in 2024 while the log
    // continued, so calling its later era "Now" is a false claim.
    expect(isCurrentEra(eraEnding('2024-04-16'), '2026-08-09')).toBe(false)
  })

  it('draws the line at the same silence that separates two eras', () => {
    expect(isCurrentEra(eraEnding('2026-02-10'), '2026-08-09', 180)).toBe(true)
    expect(isCurrentEra(eraEnding('2026-02-08'), '2026-08-09', 180)).toBe(false)
    expect(DEFAULT_CURRENT_WITHIN_DAYS).toBe(DEFAULT_MIN_GAP_DAYS)
  })

  it('refuses to claim currency with nothing to measure against', () => {
    expect(isCurrentEra(eraEnding('2026-08-09'), '')).toBe(false)
  })

  it('does not go stale as the log grows — it moves with it', () => {
    // The whole point of measuring against the log rather than the wall clock:
    // pick a movement back up and its era becomes current again, with no
    // hardcoded date to revisit.
    const era = eraEnding('2026-08-09')
    expect(isCurrentEra(era, '2026-08-09')).toBe(true)
    expect(isCurrentEra(era, '2027-06-01')).toBe(false)
  })
})

describe('eraIsImported', () => {
  /** A logged set of `exercise` on `dayKey`, optionally from the notes archive. */
  function set(dayKey: string, exercise: string, source?: 'icloud_notes'): StrengthSet {
    return {
      id: `${exercise}-${dayKey}`,
      // Midday Pacific, so the UTC instant still buckets onto `dayKey`.
      logged_at: `${dayKey}T20:00:00Z`,
      exercise,
      reps: 8,
      ...(source === undefined ? {} : { source }),
    }
  }

  const era = {
    startDayKey: '2024-01-10',
    endDayKey: '2024-04-16',
    trainingDays: 2,
    sets: 2,
    reps: 16,
    tonnage: 0,
    heaviestSet: null,
    bestOneRepMax: null,
    typicalTopSet: null,
  }

  it('is true when an imported set of this movement falls in the era', () => {
    expect(
      eraIsImported(era, 'barbell-bench-press', [
        set('2024-02-14', 'barbell-bench-press', 'icloud_notes'),
      ])
    ).toBe(true)
  })

  it('is false when the era holds only manually logged sets', () => {
    // A long gap is not evidence of an import — a movement can simply have been
    // left alone for a year.
    expect(
      eraIsImported(era, 'barbell-bench-press', [set('2024-02-14', 'barbell-bench-press')])
    ).toBe(false)
  })

  it('ignores imported sets of a different movement in the same window', () => {
    expect(
      eraIsImported(era, 'barbell-bench-press', [set('2024-02-14', 'lat-pulldown', 'icloud_notes')])
    ).toBe(false)
  })

  it('ignores imported sets outside the era span', () => {
    expect(
      eraIsImported(era, 'barbell-bench-press', [
        set('2026-05-20', 'barbell-bench-press', 'icloud_notes'),
      ])
    ).toBe(false)
  })

  it('counts a set on the era boundary itself', () => {
    expect(
      eraIsImported(era, 'barbell-bench-press', [
        set('2024-04-16', 'barbell-bench-press', 'icloud_notes'),
      ])
    ).toBe(true)
  })
})
