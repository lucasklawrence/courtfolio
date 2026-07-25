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
  buildTrophyRoomView,
  describeAchievement,
  formatEarnedOn,
  resolveAchievements,
} from './achievements'

/**
 * Set factory. Timestamps are local-noon so the bucketing (which uses the
 * *local* calendar day) is stable regardless of the runner's timezone — the
 * same trick `strength-today`'s backdating helper uses.
 */
function set(day: string, exercise: string, reps: number): StrengthSet {
  return {
    id: `${exercise}-${day}-${reps}-${Math.random()}`,
    logged_at: `${day}T12:00:00`,
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
