/**
 * Keeps the `weight_room_sets` select list in step with its row schema.
 *
 * The failure this prevents is quiet in every way that matters: adding a field
 * to {@link WeightRoomSetRowSchema} without adding it to `SETS_COLUMNS`
 * compiles, type-checks, and passes every unit test that builds a
 * `StrengthSet` by hand — because those never touch the data layer. At runtime
 * PostgREST simply doesn't return the column, the converter never sets it, and
 * whatever depends on it takes its absent branch forever.
 *
 * It has now happened twice. `template_slot_id` (#376) made every set logged
 * against a slot reappear as extra work, and `set_group` (#440) made a
 * two-pass rack run keep counting as five sets after the whole point of the
 * change was to make it count as two. Both were caught by a person reading the
 * select list, which is not a control.
 */
import { describe, expect, it } from 'vitest'

import { SETS_COLUMNS } from './weight-room-shared'
import { WeightRoomSetRowSchema } from '@/lib/schemas/weight-room'

/** Column names the select list actually asks PostgREST for. */
const selected = new Set(SETS_COLUMNS.split(',').map(part => part.trim()))

describe('SETS_COLUMNS', () => {
  it('selects every column the row schema reads', () => {
    const missing = Object.keys(WeightRoomSetRowSchema.shape).filter(key => !selected.has(key))
    expect(
      missing,
      `these are in WeightRoomSetRowSchema but never selected, so they arrive undefined: ${missing.join(', ')}`
    ).toEqual([])
  })

  it('selects nothing the row schema would reject', () => {
    // `.strict()` on the schema means an unexpected key fails the whole read,
    // and that read validates the entire set array in one pass.
    const known = new Set(Object.keys(WeightRoomSetRowSchema.shape))
    const extra = [...selected].filter(column => !known.has(column) && column !== 'updated_at')
    expect(
      extra,
      `these are selected but absent from WeightRoomSetRowSchema: ${extra.join(', ')}`
    ).toEqual([])
  })

  it('includes the columns whose omission has already shipped a bug', () => {
    expect(selected.has('template_slot_id')).toBe(true)
    expect(selected.has('set_group')).toBe(true)
  })
})
