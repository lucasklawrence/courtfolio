import { describe, expect, it, vi } from 'vitest'

import { ensureWeightRoomExercise, titleCaseSlug } from './ensure-weight-room-exercise'

/**
 * Coverage for the catalog write-side guard (#373).
 *
 * `weight_room_goals` and `weight_room_monthly_focus` both FK
 * `weight_room_exercises`, so the routes that create them have to provision a
 * roster entry first or fail with a raw `23503`. These assert the two
 * properties that matter: a movement always gets provisioned, and an existing
 * one is never overwritten.
 */

/** Minimal Supabase stub capturing the upsert payload and options. */
function stubClient(error: { message: string } | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error })
  const from = vi.fn().mockReturnValue({ upsert })
  return { client: { from } as never, from, upsert }
}

describe('titleCaseSlug', () => {
  it('turns a kebab slug into a display label', () => {
    expect(titleCaseSlug('barbell-bench-press')).toBe('Barbell Bench Press')
    expect(titleCaseSlug('pushups')).toBe('Pushups')
  })

  it('tolerates doubled and trailing separators', () => {
    expect(titleCaseSlug('leg--press-')).toBe('Leg Press')
  })
})

describe('ensureWeightRoomExercise', () => {
  it('provisions the movement with the neutral fallback classification', async () => {
    const { client, from, upsert } = stubClient()

    await expect(ensureWeightRoomExercise(client, 'barbell-row')).resolves.toBeNull()

    expect(from).toHaveBeenCalledWith('weight_room_exercises')
    expect(upsert.mock.calls[0][0]).toMatchObject({
      slug: 'barbell-row',
      display_name: 'Barbell Row',
      equipment: 'other',
      muscle_group: 'full-body',
    })
  })

  it('never overwrites an existing row', async () => {
    const { client, upsert } = stubClient()

    await ensureWeightRoomExercise(client, 'shrugs')

    // Without ignoreDuplicates this would reset a curated movement's
    // equipment/muscle_group/load_multiplier every time its goal is re-saved —
    // shrugs would silently lose load_multiplier: 2 and halve its tonnage.
    expect(upsert.mock.calls[0][1]).toMatchObject({
      onConflict: 'slug',
      ignoreDuplicates: true,
    })
  })

  it('reports a failure as a message rather than throwing', async () => {
    const { client } = stubClient({ message: 'permission denied' })

    await expect(ensureWeightRoomExercise(client, 'dips')).resolves.toMatch(
      /permission denied/,
    )
  })
})
