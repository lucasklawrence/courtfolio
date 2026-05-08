import { describe, expect, it } from 'vitest'

import {
  WeightRoomGoalRowSchema,
  WeightRoomSetCreateSchema,
  WeightRoomSetRowSchema,
} from './weight-room'

/**
 * Schema-level coverage for the Weight Room Zod contract (#79). The
 * data layer + admin route tests already exercise the schemas
 * end-to-end; this file proves the canonical-exercise transform from
 * #181 in isolation so a regression there doesn't have to wait until
 * an API test catches it.
 */
describe('WeightRoomGoalRowSchema', () => {
  const base = { exercise: 'pushups', daily_target: 100, color: '#EA580C' }

  it('accepts a well-formed lowercase row', () => {
    expect(WeightRoomGoalRowSchema.parse(base)).toEqual(base)
  })

  it('lowercases the exercise on parse so case-divergent duplicates collapse', () => {
    const parsed = WeightRoomGoalRowSchema.parse({ ...base, exercise: 'Pushups' })
    expect(parsed.exercise).toBe('pushups')
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

describe('WeightRoomSetRowSchema', () => {
  const base = {
    id: '00000000-0000-0000-0000-000000000000',
    logged_at: '2026-04-14T08:00:00.000Z',
    exercise: 'pushups',
    reps: 25,
  }

  it('accepts a well-formed lowercase row', () => {
    expect(WeightRoomSetRowSchema.parse(base)).toEqual(base)
  })

  it('lowercases the exercise on parse — keeps the FK key consistent', () => {
    const parsed = WeightRoomSetRowSchema.parse({ ...base, exercise: 'Pushups' })
    expect(parsed.exercise).toBe('pushups')
  })

  it('rejects a non-uuid id', () => {
    expect(() => WeightRoomSetRowSchema.parse({ ...base, id: 'nope' })).toThrow()
  })

  it('rejects a zero or negative reps count', () => {
    expect(() => WeightRoomSetRowSchema.parse({ ...base, reps: 0 })).toThrow()
    expect(() => WeightRoomSetRowSchema.parse({ ...base, reps: -3 })).toThrow()
  })
})

describe('WeightRoomSetCreateSchema', () => {
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

  it('rejects unknown fields via .strict()', () => {
    expect(() =>
      WeightRoomSetCreateSchema.parse({ exercise: 'pushups', reps: 25, surprise: 'no' }),
    ).toThrow()
  })
})
