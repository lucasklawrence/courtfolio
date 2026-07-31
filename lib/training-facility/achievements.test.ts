import { describe, expect, it } from 'vitest'

import type {
  AchievementScope,
  ExerciseGoal,
  StrengthSet,
  WeightRoomAchievement,
} from '@/types/weight-room'

import {
  POOLED_LABEL,
  achievementIcon,
  achievementUnit,
  buildTrophyRoomView,
  describeAchievement,
  formatEarnedOn,
  resolveAchievements,
  sectionLabel,
} from './achievements'

/**
 * Set factory. `19:00Z` is midday Pacific year-round (noon PDT / 11am PST), so
 * `day` is the Pacific calendar day the resolver buckets it under no matter
 * what timezone the test runner is in — a bare local timestamp would drift on
 * any runner far from Pacific.
 */
function set(day: string, exercise: string, reps: number): StrengthSet {
  return {
    id: `${exercise}-${day}-${reps}-${Math.random()}`,
    logged_at: `${day}T19:00:00Z`,
    exercise,
    reps,
  }
}

/** Achievement factory — `exercise: null` builds a pooled tier. */
function tier(
  exercise: string | null,
  scope: AchievementScope,
  threshold: number,
  extra: Partial<WeightRoomAchievement> = {},
): WeightRoomAchievement {
  return {
    id: `${exercise ?? '*'}-${scope}-${threshold}`,
    label: `${scope} ${threshold}`,
    exercise,
    scope,
    threshold,
    ...extra,
  }
}

const GOALS: ExerciseGoal[] = [
  { exercise: 'pushups', daily_target: 100, color: '#EA580C' },
  { exercise: 'pullups', daily_target: 30, color: '#0EA5A1' },
]

/** Resolve a single tier and return just its result — the common test shape. */
function resolveOne(
  sets: StrengthSet[],
  achievement: WeightRoomAchievement,
  goals: ExerciseGoal[] = GOALS,
) {
  const [result] = resolveAchievements(sets, goals, [achievement])
  return result
}

describe('resolveAchievements — day scope', () => {
  it('earns when a single day reaches the threshold', () => {
    const sets = [set('2026-07-14', 'pushups', 60), set('2026-07-14', 'pushups', 40)]
    const result = resolveOne(sets, tier('pushups', 'day', 100))
    expect(result.earned).toBe(true)
    expect(result.best).toBe(100)
    expect(result.progress).toBe(1)
    expect(result.remaining).toBe(0)
    expect(result.firstEarnedOn).toBe('2026-07-14')
  })

  it('does not earn when the reps are spread across two days', () => {
    const sets = [set('2026-07-14', 'pushups', 60), set('2026-07-15', 'pushups', 60)]
    const result = resolveOne(sets, tier('pushups', 'day', 100))
    expect(result.earned).toBe(false)
    expect(result.best).toBe(60)
    expect(result.progress).toBeCloseTo(0.6)
    expect(result.remaining).toBe(40)
    expect(result.firstEarnedOn).toBeNull()
  })

  it('counts every qualifying day and dates the earliest one', () => {
    const sets = [
      set('2026-07-20', 'pushups', 120),
      set('2026-07-14', 'pushups', 150),
      set('2026-07-16', 'pushups', 90),
    ]
    const result = resolveOne(sets, tier('pushups', 'day', 100))
    expect(result.timesEarned).toBe(2)
    expect(result.best).toBe(150)
    expect(result.firstEarnedOn).toBe('2026-07-14')
    expect(result.lastEarnedOn).toBe('2026-07-20')
    expect(result.earnedOn).toEqual(['2026-07-14', '2026-07-20'])
  })

  it('ignores other exercises', () => {
    const sets = [set('2026-07-14', 'pullups', 200)]
    expect(resolveOne(sets, tier('pushups', 'day', 100)).earned).toBe(false)
  })
})

describe('resolveAchievements — week and month scopes', () => {
  it('buckets weeks Monday–Sunday', () => {
    // 2026-07-13 is a Monday; 2026-07-19 the Sunday that closes the same week.
    const sets = [set('2026-07-13', 'pushups', 300), set('2026-07-19', 'pushups', 200)]
    const result = resolveOne(sets, tier('pushups', 'week', 500))
    expect(result.earned).toBe(true)
    expect(result.best).toBe(500)
    // The bucket key is the week's Monday.
    expect(result.firstEarnedOn).toBe('2026-07-13')
  })

  it('splits a Sunday and the following Monday into different weeks', () => {
    const sets = [set('2026-07-19', 'pushups', 300), set('2026-07-20', 'pushups', 300)]
    const result = resolveOne(sets, tier('pushups', 'week', 500))
    expect(result.earned).toBe(false)
    expect(result.best).toBe(300)
  })

  it('buckets months by calendar month and keys the earn date YYYY-MM', () => {
    const sets = [
      set('2026-07-01', 'pushups', 900),
      set('2026-07-31', 'pushups', 1200),
      set('2026-08-01', 'pushups', 500),
    ]
    const result = resolveOne(sets, tier('pushups', 'month', 2000))
    expect(result.earned).toBe(true)
    expect(result.best).toBe(2100)
    expect(result.timesEarned).toBe(1)
    expect(result.firstEarnedOn).toBe('2026-07')
  })
})

describe('resolveAchievements — lifetime scope', () => {
  it('sums every set and dates the day the running total crossed', () => {
    const sets = [
      set('2026-07-01', 'pushups', 400),
      set('2026-07-02', 'pushups', 400),
      set('2026-07-03', 'pushups', 400),
    ]
    const result = resolveOne(sets, tier('pushups', 'lifetime', 1000))
    expect(result.earned).toBe(true)
    expect(result.best).toBe(1200)
    expect(result.firstEarnedOn).toBe('2026-07-03')
  })

  it('is earned at most once even when the total keeps climbing', () => {
    const sets = [set('2026-07-01', 'pushups', 5000), set('2026-07-02', 'pushups', 5000)]
    expect(resolveOne(sets, tier('pushups', 'lifetime', 1000)).timesEarned).toBe(1)
  })

  it('reports the total as `best` when the threshold is not reached', () => {
    const result = resolveOne([set('2026-07-01', 'pushups', 250)], tier('pushups', 'lifetime', 1000))
    expect(result.earned).toBe(false)
    expect(result.best).toBe(250)
    expect(result.remaining).toBe(750)
  })
})

describe('resolveAchievements — set scope', () => {
  it('measures a single set, not the day total', () => {
    const sets = [set('2026-07-14', 'pushups', 15), set('2026-07-14', 'pushups', 15)]
    const result = resolveOne(sets, tier('pushups', 'set', 20))
    expect(result.earned).toBe(false)
    expect(result.best).toBe(15)
  })

  it('earns on the first qualifying set and counts them all', () => {
    const sets = [
      set('2026-07-14', 'pushups', 25),
      set('2026-07-16', 'pushups', 30),
      set('2026-07-18', 'pushups', 10),
    ]
    const result = resolveOne(sets, tier('pushups', 'set', 20))
    expect(result.earned).toBe(true)
    expect(result.best).toBe(30)
    expect(result.timesEarned).toBe(2)
    expect(result.firstEarnedOn).toBe('2026-07-14')
  })
})

describe('resolveAchievements — streak scope', () => {
  /**
   * Consecutive goal-hit days starting at `start`, `days` long. The day key is
   * rebuilt from *local* date parts rather than `toISOString()` — the cursor is
   * a local-noon Date, so a UTC round-trip would shift the key back a day in
   * any positive-offset timezone and make these assertions machine-dependent.
   */
  function streakSets(start: string, days: number, exercise = 'pushups', reps = 100): StrengthSet[] {
    const out: StrengthSet[] = []
    const cursor = new Date(`${start}T12:00:00`)
    for (let i = 0; i < days; i++) {
      const key = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, '0'),
        String(cursor.getDate()).padStart(2, '0'),
      ].join('-')
      out.push(set(key, exercise, reps))
      cursor.setDate(cursor.getDate() + 1)
    }
    return out
  }

  it('counts consecutive days that hit the daily target', () => {
    const result = resolveOne(streakSets('2026-07-01', 5), tier('pushups', 'streak', 5))
    expect(result.earned).toBe(true)
    expect(result.best).toBe(5)
    expect(result.firstEarnedOn).toBe('2026-07-05')
  })

  it('does not count a day that fell short of the target', () => {
    const sets = [
      ...streakSets('2026-07-01', 2),
      set('2026-07-03', 'pushups', 40), // under the 100 target — breaks the run
      ...streakSets('2026-07-04', 2),
    ]
    const result = resolveOne(sets, tier('pushups', 'streak', 3))
    expect(result.earned).toBe(false)
    expect(result.best).toBe(2)
  })

  it('earns a tier once per run, not once per day of a long run', () => {
    const result = resolveOne(streakSets('2026-07-01', 20), tier('pushups', 'streak', 7))
    expect(result.timesEarned).toBe(1)
    expect(result.best).toBe(20)
    expect(result.firstEarnedOn).toBe('2026-07-07')
  })

  it('counts two separate runs that each reach the threshold', () => {
    const sets = [...streakSets('2026-07-01', 3), ...streakSets('2026-07-10', 3)]
    const result = resolveOne(sets, tier('pushups', 'streak', 3))
    expect(result.timesEarned).toBe(2)
    expect(result.firstEarnedOn).toBe('2026-07-03')
  })

  it('is always 0 for an exercise with no configured goal', () => {
    const sets = streakSets('2026-07-01', 10, 'dips', 100)
    const result = resolveOne(sets, tier('dips', 'streak', 3))
    expect(result.earned).toBe(false)
    expect(result.best).toBe(0)
  })
})

describe('resolveAchievements — pooled ladder', () => {
  it('sums volume across every exercise', () => {
    const sets = [set('2026-07-14', 'pushups', 150), set('2026-07-14', 'pullups', 60)]
    const result = resolveOne(sets, tier(null, 'day', 200))
    expect(result.earned).toBe(true)
    expect(result.best).toBe(210)
  })

  it('takes the biggest single set of any exercise, not the day total', () => {
    const sets = [set('2026-07-14', 'pushups', 15), set('2026-07-14', 'pullups', 12)]
    const result = resolveOne(sets, tier(null, 'set', 20))
    expect(result.earned).toBe(false)
    expect(result.best).toBe(15)
  })

  it('streaks on days where at least one exercise hit its own goal', () => {
    // Neither exercise alone has a 3-day run, but every day hits one of them.
    const sets = [
      set('2026-07-01', 'pushups', 100),
      set('2026-07-02', 'pullups', 30),
      set('2026-07-03', 'pushups', 100),
    ]
    expect(resolveOne(sets, tier('pushups', 'streak', 3)).earned).toBe(false)
    const pooled = resolveOne(sets, tier(null, 'streak', 3))
    expect(pooled.earned).toBe(true)
    expect(pooled.best).toBe(3)
  })
})

describe('resolveAchievements — repeatable badges', () => {
  it('re-earns a day tier every qualifying day, in order', () => {
    const sets = [
      set('2026-07-14', 'pushups', 120),
      set('2026-07-18', 'pushups', 105),
      set('2026-07-22', 'pushups', 300),
    ]
    const result = resolveOne(sets, tier('pushups', 'day', 100))
    expect(result.timesEarned).toBe(3)
    expect(result.earnedOn).toEqual(['2026-07-14', '2026-07-18', '2026-07-22'])
    expect(result.firstEarnedOn).toBe('2026-07-14')
    expect(result.lastEarnedOn).toBe('2026-07-22')
  })

  it('re-earns a set tier per qualifying set, so one day can earn it twice', () => {
    const sets = [
      set('2026-07-14', 'pushups', 25),
      set('2026-07-14', 'pushups', 22),
      set('2026-07-14', 'pushups', 8),
    ]
    const result = resolveOne(sets, tier('pushups', 'set', 20))
    expect(result.timesEarned).toBe(2)
    expect(result.earnedOn).toEqual(['2026-07-14', '2026-07-14'])
  })

  it('re-earns a streak tier once per separate run', () => {
    const day = (n: number) => `2026-07-${String(n).padStart(2, '0')}`
    const sets = [
      // Three-day run, a miss, then another three-day run.
      ...[1, 2, 3].map((n) => set(day(n), 'pushups', 100)),
      ...[10, 11, 12].map((n) => set(day(n), 'pushups', 100)),
    ]
    const result = resolveOne(sets, tier('pushups', 'streak', 3))
    expect(result.timesEarned).toBe(2)
    expect(result.earnedOn).toEqual(['2026-07-03', '2026-07-12'])
    expect(result.lastEarnedOn).toBe('2026-07-12')
  })

  it('never re-earns a lifetime tier — a cumulative total is crossed once', () => {
    const sets = [
      set('2026-07-01', 'pushups', 600),
      set('2026-07-02', 'pushups', 600),
      set('2026-07-03', 'pushups', 600),
    ]
    const result = resolveOne(sets, tier('pushups', 'lifetime', 1000))
    expect(result.timesEarned).toBe(1)
    expect(result.firstEarnedOn).toBe('2026-07-02')
    expect(result.lastEarnedOn).toBe('2026-07-02')
  })

  it('reports first and last as the same bucket for a single earn', () => {
    const result = resolveOne([set('2026-07-14', 'pushups', 120)], tier('pushups', 'day', 100))
    expect(result.timesEarned).toBe(1)
    expect(result.firstEarnedOn).toBe('2026-07-14')
    expect(result.lastEarnedOn).toBe('2026-07-14')
  })

  it('leaves an unearned tier with no earn history', () => {
    const result = resolveOne([set('2026-07-14', 'pushups', 40)], tier('pushups', 'day', 100))
    expect(result.earnedOn).toEqual([])
    expect(result.timesEarned).toBe(0)
    expect(result.firstEarnedOn).toBeNull()
    expect(result.lastEarnedOn).toBeNull()
  })
})

describe('resolveAchievements — load measures', () => {
  /** A weighted set: `weight` is the per-implement load, as logged. */
  function wset(day: string, exercise: string, reps: number, weight: number): StrengthSet {
    return {
      id: `${exercise}-${day}-${reps}x${weight}`,
      logged_at: `${day}T19:00:00Z`,
      exercise,
      reps,
      weight_lbs: weight,
    }
  }

  /** shrugs carries two dumbbells; pushups is a single-implement (vest) movement. */
  const LOAD_GOALS: ExerciseGoal[] = [
    { exercise: 'shrugs', daily_target: 100, color: '#C9A268', load_multiplier: 2 },
    { exercise: 'pushups', daily_target: 100, color: '#EA580C' },
  ]

  const loaded = (
    sets: StrengthSet[],
    achievement: WeightRoomAchievement,
  ): ReturnType<typeof resolveOne> => resolveOne(sets, achievement, LOAD_GOALS)

  it('doubles tonnage for a two-implement movement', () => {
    // 10 reps × 60 lb per hand × 2 dumbbells = 1,200 lb.
    const result = loaded(
      [wset('2026-07-14', 'shrugs', 10, 60)],
      tier('shrugs', 'day', 1200, { measure: 'tonnage' }),
    )
    expect(result.best).toBe(1200)
    expect(result.earned).toBe(true)
  })

  it('leaves a single-implement movement at face value', () => {
    // 10 reps × 20 lb vest × 1 = 200 lb, not 400.
    const result = loaded(
      [wset('2026-07-14', 'pushups', 10, 20)],
      tier('pushups', 'day', 400, { measure: 'tonnage' }),
    )
    expect(result.best).toBe(200)
    expect(result.earned).toBe(false)
  })

  it('treats a missing multiplier as a single implement', () => {
    const result = resolveOne(
      [wset('2026-07-14', 'dips', 10, 25)],
      tier('dips', 'day', 250, { measure: 'tonnage' }),
      [],
    )
    expect(result.best).toBe(250)
    expect(result.earned).toBe(true)
  })

  it('sums tonnage across a week and a month', () => {
    const sets = [
      wset('2026-07-13', 'shrugs', 10, 50), // 1,000
      wset('2026-07-19', 'shrugs', 10, 50), // 1,000 — same ISO week
      wset('2026-07-20', 'shrugs', 10, 50), // 1,000 — next week, same month
    ]
    expect(loaded(sets, tier('shrugs', 'week', 2000, { measure: 'tonnage' })).best).toBe(2000)
    expect(loaded(sets, tier('shrugs', 'month', 3000, { measure: 'tonnage' })).best).toBe(3000)
  })

  it('measures top-set load as total pounds under load', () => {
    const sets = [wset('2026-07-14', 'shrugs', 8, 45), wset('2026-07-16', 'shrugs', 5, 60)]
    const result = loaded(sets, tier('shrugs', 'set', 120, { measure: 'load' }))
    expect(result.best).toBe(120) // 60 in each hand
    expect(result.earned).toBe(true)
    expect(result.firstEarnedOn).toBe('2026-07-16')
  })

  it('measures single-set tonnage as reps × total load, not the day total', () => {
    const sets = [wset('2026-07-14', 'shrugs', 10, 50), wset('2026-07-14', 'shrugs', 10, 50)]
    const result = loaded(sets, tier('shrugs', 'set', 1500, { measure: 'tonnage' }))
    // Each set is 10 × 100 = 1,000; the day totals 2,000 but no single set clears 1,500.
    expect(result.best).toBe(1000)
    expect(result.earned).toBe(false)
  })

  it('never earns a load or tonnage tier from bodyweight sets', () => {
    const bodyweight = [set('2026-07-14', 'pushups', 200)]
    expect(loaded(bodyweight, tier('pushups', 'set', 20, { measure: 'load' })).earned).toBe(false)
    expect(loaded(bodyweight, tier('pushups', 'day', 100, { measure: 'tonnage' })).earned).toBe(
      false,
    )
    // The same sets still earn the rep ladder.
    expect(loaded(bodyweight, tier('pushups', 'day', 100)).earned).toBe(true)
  })

  it('pools tonnage across movements using each one’s own multiplier', () => {
    const sets = [
      wset('2026-07-14', 'shrugs', 10, 50), // 10 × 100 = 1,000
      wset('2026-07-14', 'pushups', 10, 20), // 10 ×  20 =   200
    ]
    expect(loaded(sets, tier(null, 'day', 1200, { measure: 'tonnage' })).best).toBe(1200)
  })

  it('keeps a streak on reps even when the tier asks for tonnage', () => {
    // A streak has no tonnage bar to clear — daily_target is a rep target — so
    // it resolves as a plain rep streak rather than silently reporting zero.
    const sets = [
      wset('2026-07-01', 'shrugs', 100, 50),
      wset('2026-07-02', 'shrugs', 100, 50),
    ]
    const result = loaded(sets, tier('shrugs', 'streak', 2, { measure: 'tonnage' }))
    expect(result.best).toBe(2)
    expect(result.earned).toBe(true)
  })
})

describe('resolveAchievements — Pacific day bucketing', () => {
  /** A set at an explicit UTC instant, so the bucketing zone is what's under test. */
  function utcSet(iso: string, exercise: string, reps: number): StrengthSet {
    return { id: `${exercise}-${iso}-${reps}`, logged_at: iso, exercise, reps }
  }

  it('keeps a late-evening Pacific set on the Pacific day, not the UTC one', () => {
    // 2026-07-15T05:00:00Z is 10pm PT on the 14th. Bucketing by UTC would file
    // it under the 15th and split the day's total in half.
    const sets = [
      utcSet('2026-07-14T20:00:00Z', 'pushups', 60), // 1pm PT, the 14th
      utcSet('2026-07-15T05:00:00Z', 'pushups', 60), // 10pm PT, still the 14th
    ]
    const result = resolveOne(sets, tier('pushups', 'day', 100))
    expect(result.best).toBe(120)
    expect(result.earned).toBe(true)
    expect(result.firstEarnedOn).toBe('2026-07-14')
  })

  it('keeps an early-morning UTC set on the previous Pacific day', () => {
    // 2026-07-15T06:59:00Z is 11:59pm PT on the 14th.
    const result = resolveOne(
      [utcSet('2026-07-15T06:59:00Z', 'pushups', 100)],
      tier('pushups', 'day', 100),
    )
    expect(result.firstEarnedOn).toBe('2026-07-14')
  })

  it('does not merge two genuinely different Pacific days', () => {
    const sets = [
      utcSet('2026-07-15T05:00:00Z', 'pushups', 60), // 10pm PT the 14th
      utcSet('2026-07-15T17:00:00Z', 'pushups', 60), // 10am PT the 15th
    ]
    expect(resolveOne(sets, tier('pushups', 'day', 100)).earned).toBe(false)
  })

  it('counts a Pacific-midnight-spanning pair as a two-day streak', () => {
    const sets = [
      utcSet('2026-07-15T05:00:00Z', 'pushups', 100), // 10pm PT the 14th
      utcSet('2026-07-16T05:00:00Z', 'pushups', 100), // 10pm PT the 15th
    ]
    const result = resolveOne(sets, tier('pushups', 'streak', 2))
    expect(result.best).toBe(2)
    expect(result.earned).toBe(true)
  })
})

describe('resolveAchievements — edge cases', () => {
  it('resolves every tier to zero when there are no sets', () => {
    const results = resolveAchievements([], GOALS, [
      tier('pushups', 'day', 100),
      tier('pushups', 'streak', 7),
      tier(null, 'lifetime', 1000),
    ])
    expect(results.every((r) => !r.earned && r.best === 0 && r.progress === 0)).toBe(true)
  })

  it('returns an empty array for an empty ladder', () => {
    expect(resolveAchievements([set('2026-07-14', 'pushups', 100)], GOALS, [])).toEqual([])
  })

  it('skips sets with an unparseable timestamp', () => {
    const bad: StrengthSet = { id: 'bad', logged_at: 'not-a-date', exercise: 'pushups', reps: 500 }
    const result = resolveOne([bad, set('2026-07-14', 'pushups', 60)], tier('pushups', 'day', 100))
    expect(result.best).toBe(60)
  })

  it('keeps an exercise literally named "*" separate from the pooled ladder', () => {
    // Uniqueness used to be keyed on `coalesce(exercise, '*')`, which collapsed
    // a movement named `*` onto the pooled row. The resolver had the same
    // sentinel; both now key on `null` itself.
    const sets = [set('2026-07-14', '*', 40), set('2026-07-14', 'pushups', 90)]
    const starred = resolveOne(sets, tier('*', 'day', 100))
    const pooled = resolveOne(sets, tier(null, 'day', 100))

    expect(starred.best).toBe(40) // only the `*` movement
    expect(starred.earned).toBe(false)
    expect(pooled.best).toBe(130) // every movement, including `*`
    expect(pooled.earned).toBe(true)
  })

  it('resolves a tier for an exercise that has never been logged', () => {
    const result = resolveOne([set('2026-07-14', 'pushups', 100)], tier('dips', 'day', 50))
    expect(result.earned).toBe(false)
    expect(result.best).toBe(0)
    expect(result.remaining).toBe(50)
  })
})

describe('buildTrophyRoomView', () => {
  const LADDER: WeightRoomAchievement[] = [
    tier('pushups', 'day', 100),
    tier('pushups', 'day', 200),
    tier('pushups', 'lifetime', 1000),
    tier('pullups', 'day', 50),
    tier(null, 'day', 300),
  ]
  const SETS = [
    set('2026-07-14', 'pushups', 150),
    set('2026-07-14', 'pullups', 60),
    set('2026-07-15', 'pushups', 120),
  ]

  it('puts the pooled ladder first, then exercises alphabetically', () => {
    const view = buildTrophyRoomView(SETS, GOALS, LADDER)
    expect(view.groups.map((g) => g.label)).toEqual([POOLED_LABEL, 'pullups', 'pushups'])
    expect(view.groups[0].exercise).toBeNull()
  })

  it('tallies earned counts overall and per group', () => {
    const view = buildTrophyRoomView(SETS, GOALS, LADDER)
    // Earned: pushups day-100, pushups lifetime-1000 (270 total? no — 270 < 1000),
    // pullups day-50, pooled day-300 (210 on the 14th — not earned).
    expect(view.totalCount).toBe(5)
    const pushups = view.groups.find((g) => g.exercise === 'pushups')
    expect(pushups?.earnedCount).toBe(1)
    expect(view.earnedCount).toBe(2)
  })

  it('carries the exercise goal color onto its group', () => {
    const view = buildTrophyRoomView(SETS, GOALS, LADDER)
    expect(view.groups.find((g) => g.exercise === 'pushups')?.color).toBe('#EA580C')
    expect(view.groups[0].color).toBeNull()
  })

  it('orders tiers within a group by scope then ascending threshold', () => {
    const view = buildTrophyRoomView(SETS, GOALS, LADDER)
    const pushups = view.groups.find((g) => g.exercise === 'pushups')
    expect(pushups?.achievements.map((a) => a.achievement.threshold)).toEqual([100, 200, 1000])
  })

  it('ranks nextUp by progress and excludes untouched tiers', () => {
    const view = buildTrophyRoomView(SETS, GOALS, LADDER)
    // pushups day-200 (150/200 = .75) beats pooled day-300 (210/300 = .7),
    // which beats pushups lifetime-1000 (270/1000 = .27).
    expect(view.nextUp.map((e) => e.achievement.threshold)).toEqual([200, 300, 1000])
  })

  it('excludes zero-progress tiers from nextUp', () => {
    const view = buildTrophyRoomView([], GOALS, LADDER)
    expect(view.nextUp).toEqual([])
    expect(view.earnedCount).toBe(0)
  })

  it('lists recently earned badges newest first', () => {
    const sets = [set('2026-07-01', 'pullups', 60), set('2026-07-20', 'pushups', 150)]
    const view = buildTrophyRoomView(sets, GOALS, LADDER)
    expect(view.recent.map((e) => e.firstEarnedOn)).toEqual(['2026-07-20', '2026-07-01'])
  })

  it('returns an empty view for an empty ladder', () => {
    const view = buildTrophyRoomView(SETS, GOALS, [])
    expect(view).toEqual({ groups: [], earnedCount: 0, totalCount: 0, recent: [], nextUp: [] })
  })
})

describe('describeAchievement', () => {
  it('phrases each scope in its own units', () => {
    expect(describeAchievement(tier('pushups', 'day', 100))).toBe('100 reps in a day')
    expect(describeAchievement(tier('pushups', 'week', 1000))).toBe('1,000 reps in a week')
    expect(describeAchievement(tier('pushups', 'month', 2000))).toBe('2,000 reps in a month')
    expect(describeAchievement(tier('pushups', 'streak', 30))).toBe('30-day streak')
    expect(describeAchievement(tier('pushups', 'lifetime', 10000))).toBe('10,000 reps all-time')
    expect(describeAchievement(tier('pushups', 'set', 20))).toBe('20 reps in one set')
  })

  it('switches to pounds for tonnage and load tiers', () => {
    expect(describeAchievement(tier('shrugs', 'day', 10000, { measure: 'tonnage' }))).toBe(
      '10,000 lb in a day',
    )
    expect(describeAchievement(tier('shrugs', 'set', 1400, { measure: 'tonnage' }))).toBe(
      '1,400 lb in one set',
    )
    expect(describeAchievement(tier('shrugs', 'set', 120, { measure: 'load' }))).toBe(
      '120 lb on one set',
    )
  })

  it('still counts days for a streak whatever the measure', () => {
    expect(describeAchievement(tier('shrugs', 'streak', 14, { measure: 'tonnage' }))).toBe(
      '14-day streak',
    )
  })
})

describe('achievementUnit', () => {
  it('labels reps, pounds, and days', () => {
    expect(achievementUnit(tier('pushups', 'day', 100))).toBe('reps')
    expect(achievementUnit(tier('shrugs', 'day', 5000, { measure: 'tonnage' }))).toBe('lb')
    expect(achievementUnit(tier('shrugs', 'set', 120, { measure: 'load' }))).toBe('lb')
    expect(achievementUnit(tier('pushups', 'streak', 7))).toBe('days')
  })
})

describe('sectionLabel', () => {
  it('distinguishes the rep, tonnage, and load ladders of one scope', () => {
    expect(sectionLabel('day', 'reps')).toBe('Single day')
    expect(sectionLabel('day', 'tonnage')).toBe('Single day · weight moved')
    expect(sectionLabel('set', 'load')).toBe('Top-set load')
  })
})

describe('achievementIcon', () => {
  it('prefers the tier’s configured icon', () => {
    expect(achievementIcon(tier('pushups', 'day', 100, { icon: '🚀' }))).toBe('🚀')
  })

  it('falls back to a scope default', () => {
    expect(achievementIcon(tier('pushups', 'streak', 7))).toBe('🔥')
  })
})

describe('formatEarnedOn', () => {
  it('renders a day key with the day of month', () => {
    expect(formatEarnedOn('2026-07-14', 'day')).toBe('Jul 14, 2026')
  })

  it('renders a month key as month + year', () => {
    expect(formatEarnedOn('2026-07', 'month')).toBe('Jul 2026')
  })

  it('is empty for a null or unparseable key', () => {
    expect(formatEarnedOn(null, 'day')).toBe('')
    expect(formatEarnedOn('nonsense', 'day')).toBe('')
  })
})

/**
 * Effective-dated targets (#362). Badges are recomputed from the full log on
 * every render, so a `'streak'` tier that read the *current* target would
 * un-light the moment a goal was raised — retroactively taking away a badge
 * that was genuinely earned.
 */
describe('streak scope with effective-dated targets (#362)', () => {
  /** Pullups seeded at 30, raised to 50 on 2026-08-01. */
  const PULLUPS_RAISED: ExerciseGoal = {
    exercise: 'pullups',
    daily_target: 50,
    color: '#0EA5A1',
    target_history: [
      { daily_target: 30, effective_from: '2026-05-01' },
      { daily_target: 50, effective_from: '2026-08-01' },
    ],
  }

  /** Three consecutive 30-rep July days — a 3-day streak against the 30 goal. */
  const JULY_STREAK: StrengthSet[] = [
    set('2026-07-15', 'pullups', 30),
    set('2026-07-16', 'pullups', 30),
    set('2026-07-17', 'pullups', 30),
  ]

  it('keeps a streak badge earned after the goal is raised', () => {
    const result = resolveOne(JULY_STREAK, tier('pullups', 'streak', 3), [PULLUPS_RAISED])
    expect(result.earned).toBe(true)
    expect(result.best).toBe(3)
  })

  it('un-lights nothing that was never earned — a post-change miss still misses', () => {
    const augustShort = [
      set('2026-08-15', 'pullups', 30),
      set('2026-08-16', 'pullups', 30),
      set('2026-08-17', 'pullups', 30),
    ]
    // 30 reps no longer clears the 50 bar in force in August.
    const result = resolveOne(augustShort, tier('pullups', 'streak', 3), [PULLUPS_RAISED])
    expect(result.earned).toBe(false)
    expect(result.best).toBe(0)
  })

  it('counts a streak spanning the change against each day’s own target', () => {
    const spanning = [
      set('2026-07-30', 'pullups', 30),
      set('2026-07-31', 'pullups', 30),
      set('2026-08-01', 'pullups', 50),
      set('2026-08-02', 'pullups', 50),
    ]
    const result = resolveOne(spanning, tier('pullups', 'streak', 4), [PULLUPS_RAISED])
    expect(result.earned).toBe(true)
    expect(result.best).toBe(4)
  })

  it('leaves a goal with no target history scored exactly as before', () => {
    const result = resolveOne(
      [
        set('2026-07-15', 'pushups', 100),
        set('2026-07-16', 'pushups', 100),
        set('2026-07-17', 'pushups', 100),
      ],
      tier('pushups', 'streak', 3),
      GOALS,
    )
    expect(result.earned).toBe(true)
    expect(result.best).toBe(3)
  })
})
