import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { pruneNoteImports } from './icloud-notes-supabase.mjs'

/**
 * Coverage for the destructive half of the iCloud Notes import (#436).
 *
 * Everything else this module does is an upsert, which fails loudly and
 * converges on a re-run. `pruneNoteImports` deletes, and it exists precisely
 * because reclassifying a note as a programme document has to remove what a
 * previous run already wrote — so the two things worth pinning are that it
 * removes what it should and, much more importantly, nothing else.
 */

/** A row the stub will hand back from a `.delete()` or count. */
interface StubSet {
  workout_id: string | null
}

/**
 * Minimal Supabase stub covering the three chains the pruner uses:
 * `.delete().like().select()`, `.select(count, head)`, and
 * `.delete().eq().eq().select()`.
 *
 * Cast rather than mocked wholesale, following `weight-room-supabase.test.ts`:
 * standing up the rest of `SupabaseClient` would bury the three calls that
 * matter.
 */
function stubClient(options: {
  /** Sets returned per `like` pattern. */
  setsByPattern: Record<string, StubSet[]>
  /** Remaining set count per workout id, consulted after the delete. */
  remainingByWorkout: Record<string, number>
  /** Workout ids the stub will admit to deleting. */
  deletableWorkouts: string[]
}) {
  const deletedPatterns: string[] = []
  const deletedWorkouts: string[] = []
  const countedWorkouts: string[] = []

  const client = {
    from(table: string) {
      return {
        delete() {
          return {
            // Sets: .delete().like(...).select(...)
            like(_column: string, pattern: string) {
              deletedPatterns.push(pattern)
              return {
                select() {
                  return Promise.resolve({
                    data: options.setsByPattern[pattern] ?? [],
                    error: null,
                  })
                },
              }
            },
            // Workouts: .delete().eq('id', …).eq('source', …).select(…)
            eq(_column: string, id: string) {
              return {
                eq() {
                  return {
                    select() {
                      const deletable = options.deletableWorkouts.includes(id)
                      if (deletable) deletedWorkouts.push(id)
                      return Promise.resolve({
                        data: deletable ? [{ id }] : [],
                        error: null,
                      })
                    },
                  }
                },
              }
            },
          }
        },
        select(_columns: string, _opts: unknown) {
          return {
            eq(_column: string, workoutId: string) {
              countedWorkouts.push(workoutId)
              return Promise.resolve({
                count: options.remainingByWorkout[workoutId] ?? 0,
                error: null,
              })
            },
          }
        },
        _table: table,
      }
    },
  } as unknown as SupabaseClient

  return { client, deletedPatterns, deletedWorkouts, countedWorkouts }
}

describe('pruneNoteImports', () => {
  it('deletes only sets whose import key names the note', () => {
    const { client, deletedPatterns } = stubClient({
      setsByPattern: { 'icloud:Strength Cycle:%': [] },
      remainingByWorkout: {},
      deletableWorkouts: [],
    })

    return pruneNoteImports(client, ['Strength Cycle']).then(result => {
      expect(deletedPatterns).toEqual(['icloud:Strength Cycle:%'])
      expect(result).toEqual({ sets: 0, sessions: 0 })
    })
  })

  it('removes the session once nothing is left on it', async () => {
    const { client, deletedWorkouts } = stubClient({
      setsByPattern: {
        'icloud:Strength Cycle:%': [{ workout_id: 'w1' }, { workout_id: 'w1' }],
      },
      remainingByWorkout: { w1: 0 },
      deletableWorkouts: ['w1'],
    })

    const result = await pruneNoteImports(client, ['Strength Cycle'])
    expect(result).toEqual({ sets: 2, sessions: 1 })
    expect(deletedWorkouts).toEqual(['w1'])
  })

  it('keeps a session that still holds other sets', async () => {
    // A Health session shared with a real note, or one carrying app-logged
    // sets, must survive having some of its rows pruned.
    const { client, deletedWorkouts } = stubClient({
      setsByPattern: { 'icloud:Strength Cycle:%': [{ workout_id: 'shared' }] },
      remainingByWorkout: { shared: 12 },
      deletableWorkouts: ['shared'],
    })

    const result = await pruneNoteImports(client, ['Strength Cycle'])
    expect(result.sets).toBe(1)
    expect(result.sessions).toBe(0)
    expect(deletedWorkouts).toEqual([])
  })

  it('never deletes a workout that is not an icloud_notes session', async () => {
    // The `source` filter is what stops it reaching an Apple Health row that
    // existed before this import and is not ours to remove.
    const { client, deletedWorkouts } = stubClient({
      setsByPattern: { 'icloud:Strength Cycle:%': [{ workout_id: 'health-row' }] },
      remainingByWorkout: { 'health-row': 0 },
      // The stub refuses it, standing in for the `source` predicate not matching.
      deletableWorkouts: [],
    })

    const result = await pruneNoteImports(client, ['Strength Cycle'])
    expect(result.sessions).toBe(0)
    expect(deletedWorkouts).toEqual([])
  })

  it('ignores sets that were never attached to a session', async () => {
    const { client, countedWorkouts } = stubClient({
      setsByPattern: { 'icloud:Strength Cycle:%': [{ workout_id: null }] },
      remainingByWorkout: {},
      deletableWorkouts: [],
    })

    const result = await pruneNoteImports(client, ['Strength Cycle'])
    expect(result).toEqual({ sets: 1, sessions: 0 })
    expect(countedWorkouts).toEqual([])
  })

  it('does nothing when there is nothing to skip', async () => {
    const { client, deletedPatterns } = stubClient({
      setsByPattern: {},
      remainingByWorkout: {},
      deletableWorkouts: [],
    })

    expect(await pruneNoteImports(client, [])).toEqual({ sets: 0, sessions: 0 })
    expect(deletedPatterns).toEqual([])
  })
})
