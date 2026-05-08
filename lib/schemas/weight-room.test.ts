import { describe, expect, it } from 'vitest'

import {
  WeightRoomGoalRowSchema,
  WeightRoomGoalUpsertSchema,
  WeightRoomSetCreateSchema,
  WeightRoomSetRowSchema,
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

  it('rejects unknown fields via .strict()', () => {
    expect(() =>
      WeightRoomSetCreateSchema.parse({ exercise: 'pushups', reps: 25, surprise: 'no' }),
    ).toThrow()
  })
})
