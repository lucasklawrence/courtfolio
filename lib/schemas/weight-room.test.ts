import { describe, expect, it } from 'vitest'

import {
  WeightRoomAchievementCreateSchema,
  WeightRoomAchievementUpdateSchema,
  WeightRoomGoalRowSchema,
  WeightRoomGoalUpsertSchema,
  WeightRoomMonthlyFocusCreateSchema,
  WeightRoomMonthlyFocusRowSchema,
  WeightRoomSetCreateSchema,
  WeightRoomSetRowSchema,
  setRowToStrengthSet,
} from './weight-room'

/**
 * Schema-level coverage for the Weight Room Zod contract (#79).
 * Read-side schemas preserve DB casing; write-side schemas lowercase
 * `exercise` to keep direct API consumers from creating case-divergent
 * duplicates (#181, Codex P1 follow-up). Tests below assert that split.
 */
describe('WeightRoomGoalRowSchema (read)', () => {
  const base = { exercise: 'pushups', daily_target: 100, color: '#EA580C' }

  it('accepts a well-formed lowercase row', () => {
    expect(WeightRoomGoalRowSchema.parse(base)).toEqual(base)
  })

  it('preserves DB casing on read so a Settings save round-trips to the same row', () => {
    // Codex P1: lowercasing on read would break the round-trip — the UI
    // would re-POST the lowercased key and Supabase's exact-match
    // upsert would INSERT a duplicate instead of UPDATING the original.
    const parsed = WeightRoomGoalRowSchema.parse({ ...base, exercise: 'Pushups' })
    expect(parsed.exercise).toBe('Pushups')
  })

  it('rejects an empty exercise', () => {
    expect(() => WeightRoomGoalRowSchema.parse({ ...base, exercise: '' })).toThrow()
  })

  it('rejects a non-positive daily_target', () => {
    expect(() => WeightRoomGoalRowSchema.parse({ ...base, daily_target: 0 })).toThrow()
    expect(() => WeightRoomGoalRowSchema.parse({ ...base, daily_target: -1 })).toThrow()
  })

  it('rejects a non-hex color', () => {
    expect(() => WeightRoomGoalRowSchema.parse({ ...base, color: 'orange' })).toThrow()
  })
})

describe('WeightRoomGoalUpsertSchema (write body)', () => {
  it('lowercases the exercise so duplicates collapse onto the existing row', () => {
    const parsed = WeightRoomGoalUpsertSchema.parse({
      exercise: 'PUSHUPS',
      daily_target: 100,
      color: '#EA580C',
    })
    expect(parsed.exercise).toBe('pushups')
  })

  it('trims surrounding whitespace before lowercasing', () => {
    const parsed = WeightRoomGoalUpsertSchema.parse({
      exercise: '  Pushups  ',
      daily_target: 100,
      color: '#EA580C',
    })
    expect(parsed.exercise).toBe('pushups')
  })

  it('rejects whitespace-only exercise input post-trim', () => {
    expect(() =>
      WeightRoomGoalUpsertSchema.parse({
        exercise: '   ',
        daily_target: 100,
        color: '#EA580C',
      }),
    ).toThrow()
  })

  it('rejects unknown fields via .strict()', () => {
    expect(() =>
      WeightRoomGoalUpsertSchema.parse({
        exercise: 'pushups',
        daily_target: 100,
        color: '#EA580C',
        surprise: 'no',
      }),
    ).toThrow()
  })
})

describe('WeightRoomSetRowSchema (read)', () => {
  const base = {
    id: '00000000-0000-0000-0000-000000000000',
    logged_at: '2026-04-14T08:00:00.000Z',
    exercise: 'pushups',
    reps: 25,
  }

  it('accepts a well-formed lowercase row', () => {
    expect(WeightRoomSetRowSchema.parse(base)).toEqual(base)
  })

  it('preserves DB casing on read — exercise stays exactly as stored', () => {
    const parsed = WeightRoomSetRowSchema.parse({ ...base, exercise: 'Pushups' })
    expect(parsed.exercise).toBe('Pushups')
  })

  it('accepts a null variant (unspecified set)', () => {
    const parsed = WeightRoomSetRowSchema.parse({ ...base, variant: null })
    expect(parsed.variant).toBeNull()
  })

  it('preserves variant casing on read like exercise', () => {
    const parsed = WeightRoomSetRowSchema.parse({ ...base, variant: 'Wide' })
    expect(parsed.variant).toBe('Wide')
  })

  it('rejects a non-uuid id', () => {
    expect(() => WeightRoomSetRowSchema.parse({ ...base, id: 'nope' })).toThrow()
  })

  it('rejects a zero or negative reps count', () => {
    expect(() => WeightRoomSetRowSchema.parse({ ...base, reps: 0 })).toThrow()
    expect(() => WeightRoomSetRowSchema.parse({ ...base, reps: -3 })).toThrow()
  })
})

describe('WeightRoomSetCreateSchema (write body)', () => {
  it('accepts the minimum body and lowercases the exercise', () => {
    const parsed = WeightRoomSetCreateSchema.parse({ exercise: 'PUSHUPS', reps: 25 })
    expect(parsed).toEqual({ exercise: 'pushups', reps: 25 })
  })

  it('honors the optional logged_at when provided', () => {
    const parsed = WeightRoomSetCreateSchema.parse({
      exercise: 'pullups',
      reps: 5,
      logged_at: '2026-04-14T08:00:00.000Z',
    })
    expect(parsed.logged_at).toBe('2026-04-14T08:00:00.000Z')
  })

  it('lowercases and trims a provided variant so buckets never split on case', () => {
    const parsed = WeightRoomSetCreateSchema.parse({
      exercise: 'pullups',
      reps: 5,
      variant: '  Wide  ',
    })
    expect(parsed.variant).toBe('wide')
  })

  it('normalizes an empty / whitespace / null variant to undefined', () => {
    for (const variant of ['', '   ', null]) {
      const parsed = WeightRoomSetCreateSchema.parse({ exercise: 'pullups', reps: 5, variant })
      expect(parsed.variant).toBeUndefined()
    }
  })

  it('leaves variant undefined when the field is omitted', () => {
    const parsed = WeightRoomSetCreateSchema.parse({ exercise: 'pullups', reps: 5 })
    expect(parsed.variant).toBeUndefined()
  })

  it('rejects unknown fields via .strict()', () => {
    expect(() =>
      WeightRoomSetCreateSchema.parse({ exercise: 'pushups', reps: 25, surprise: 'no' }),
    ).toThrow()
  })
})

describe('setRowToStrengthSet (row → public shape)', () => {
  const row = {
    id: '00000000-0000-0000-0000-000000000000',
    logged_at: '2026-04-14T08:00:00.000Z',
    exercise: 'pullups',
    reps: 5,
  }

  it('carries a present variant through onto the StrengthSet', () => {
    expect(setRowToStrengthSet({ ...row, variant: 'wide' }).variant).toBe('wide')
  })

  it('omits variant entirely when the column is null', () => {
    const set = setRowToStrengthSet({ ...row, variant: null })
    expect('variant' in set).toBe(false)
  })

  it('omits variant when it is an empty string so no phantom bucket leaks', () => {
    const set = setRowToStrengthSet({ ...row, variant: '' })
    expect('variant' in set).toBe(false)
  })
})

describe('WeightRoomMonthlyFocusRowSchema (read)', () => {
  const base = {
    id: '33333333-3333-4333-8333-333333333333',
    exercise: 'shrugs',
    daily_target: 100,
    target_kind: 'reps' as const,
    color: '#C9A268',
    category: 'upper' as const,
    start_date: '2026-07-01',
    end_date: '2026-07-31',
  }

  it('accepts a well-formed upper-lane row', () => {
    expect(WeightRoomMonthlyFocusRowSchema.parse(base)).toEqual(base)
  })

  it('accepts the lower lane', () => {
    const parsed = WeightRoomMonthlyFocusRowSchema.parse({ ...base, category: 'lower' })
    expect(parsed.category).toBe('lower')
  })

  it('rejects a category outside the upper/lower enum', () => {
    expect(() => WeightRoomMonthlyFocusRowSchema.parse({ ...base, category: 'core' })).toThrow()
  })

  it('requires the category column (two-lane resolution depends on it)', () => {
    const { category: _omit, ...noCategory } = base
    expect(() => WeightRoomMonthlyFocusRowSchema.parse(noCategory)).toThrow()
  })
})

describe('WeightRoomMonthlyFocusCreateSchema (write body)', () => {
  const base = {
    exercise: 'shrugs',
    daily_target: 100,
    color: '#C9A268',
    category: 'lower' as const,
    start_date: '2026-07-01',
    end_date: '2026-07-31',
  }

  it('defaults target_kind to reps and lowercases the exercise', () => {
    const parsed = WeightRoomMonthlyFocusCreateSchema.parse({ ...base, exercise: 'Shrugs' })
    expect(parsed.exercise).toBe('shrugs')
    expect(parsed.target_kind).toBe('reps')
    expect(parsed.category).toBe('lower')
  })

  it('rejects a category outside the upper/lower enum', () => {
    expect(() =>
      WeightRoomMonthlyFocusCreateSchema.parse({ ...base, category: 'core' }),
    ).toThrow()
  })

  it('requires the category to be supplied', () => {
    const { category: _omit, ...noCategory } = base
    expect(() => WeightRoomMonthlyFocusCreateSchema.parse(noCategory)).toThrow()
  })

  it('rejects an end_date before the start_date', () => {
    expect(() =>
      WeightRoomMonthlyFocusCreateSchema.parse({
        ...base,
        start_date: '2026-07-31',
        end_date: '2026-07-01',
      }),
    ).toThrow()
  })
})

describe('WeightRoomAchievementCreateSchema', () => {
  const base = { label: 'Century Club', scope: 'day' as const, threshold: 100 }

  it('defaults a missing exercise to the pooled ladder and measure to reps', () => {
    expect(WeightRoomAchievementCreateSchema.parse(base)).toMatchObject({
      exercise: null,
      measure: 'reps',
    })
  })

  it('lowercases a supplied exercise', () => {
    expect(WeightRoomAchievementCreateSchema.parse({ ...base, exercise: 'PushUps' })).toMatchObject({
      exercise: 'pushups',
    })
  })

  it('rejects a non-positive threshold and an unknown measure', () => {
    expect(() => WeightRoomAchievementCreateSchema.parse({ ...base, threshold: 0 })).toThrow()
    expect(() =>
      WeightRoomAchievementCreateSchema.parse({ ...base, measure: 'calories' }),
    ).toThrow()
  })
})

describe('WeightRoomAchievementUpdateSchema', () => {
  /**
   * The regression this guards: Zod 4 applies `.default()` to a missing key even
   * inside `.partial()`. Deriving the PATCH schema from a create schema carrying
   * defaults injected `exercise: null` and `measure: 'reps'` into every patch,
   * and the route writes any key that isn't `undefined` — so retuning a single
   * threshold silently converted a per-exercise tier into a pooled one and reset
   * its measure.
   */
  it('carries only the keys that were actually sent', () => {
    expect(WeightRoomAchievementUpdateSchema.parse({ threshold: 500 })).toEqual({ threshold: 500 })
    expect(WeightRoomAchievementUpdateSchema.parse({ label: 'Renamed' })).toEqual({
      label: 'Renamed',
    })
  })

  it('never injects a default exercise or measure', () => {
    const patch = WeightRoomAchievementUpdateSchema.parse({ threshold: 500 })
    expect('exercise' in patch).toBe(false)
    expect('measure' in patch).toBe(false)
  })

  it('still applies an explicitly supplied value', () => {
    expect(WeightRoomAchievementUpdateSchema.parse({ exercise: null })).toEqual({ exercise: null })
    expect(WeightRoomAchievementUpdateSchema.parse({ measure: 'tonnage' })).toEqual({
      measure: 'tonnage',
    })
  })

  it('accepts an explicit null icon so the editor can clear one', () => {
    expect(WeightRoomAchievementUpdateSchema.parse({ icon: null })).toEqual({ icon: null })
  })

  it('rejects an empty patch', () => {
    expect(() => WeightRoomAchievementUpdateSchema.parse({})).toThrow()
  })
})
