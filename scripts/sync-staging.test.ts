/**
 * Guards the staging sync's table ordering.
 *
 * The sync copies tables one at a time in the order they're declared, so a
 * table has to come after everything it points at. That was silently untrue for
 * a long time and didn't matter: nearly every `weight_room_sets` row was loose,
 * with a null `workout_id`, so no foreign key was exercised. The #400 import
 * attached sets to sessions and the next sync died on
 * `weight_room_sets_workout_id_fkey` — with `weight_room_workouts` not in the
 * manifest at all, staging could never be refreshed again, and every preview
 * deploy silently rendered a truncated log.
 *
 * The dependency map below is hand-maintained against the production schema
 * (`information_schema.table_constraints`). Adding a table to the sync means
 * adding its parents here too.
 */
import { describe, expect, it } from 'vitest'

import { TABLES } from './sync-staging.mjs'

/** child table → tables it holds foreign keys into. */
const FOREIGN_KEYS: Readonly<Record<string, readonly string[]>> = {
  // otf_sessions.booking_id → otf_bookings.id (#453). Same shape as the #400
  // failure: the manifest happens to be ordered correctly today, but without an
  // entry here nothing stops a later reorder from breaking the sync silently.
  otf_sessions: ['otf_bookings'],
  weight_room_goals: ['weight_room_exercises'],
  weight_room_goal_targets: ['weight_room_goals'],
  weight_room_monthly_focus: ['weight_room_exercises'],
  weight_room_workout_templates: [],
  weight_room_template_slots: ['weight_room_workout_templates', 'weight_room_exercises'],
  weight_room_template_slot_steps: ['weight_room_template_slots', 'weight_room_exercises'],
  weight_room_template_alternates: ['weight_room_template_slots', 'weight_room_exercises'],
  weight_room_workouts: ['weight_room_workout_templates'],
  weight_room_sets: [
    'weight_room_exercises',
    'weight_room_workouts',
    'weight_room_template_slots',
    'weight_room_template_slot_steps',
  ],
}

describe('staging sync manifest', () => {
  const names = TABLES.map(t => t.name)

  it('lists every table exactly once', () => {
    expect(new Set(names).size).toBe(names.length)
  })

  it('places each table after every table it references', () => {
    for (const [child, parents] of Object.entries(FOREIGN_KEYS)) {
      const childIndex = names.indexOf(child)
      if (childIndex === -1) continue
      for (const parent of parents) {
        const parentIndex = names.indexOf(parent)
        expect(
          parentIndex,
          `${child} references ${parent}, which is missing from the sync manifest`
        ).not.toBe(-1)
        expect(parentIndex, `${parent} must be synced before ${child}`).toBeLessThan(childIndex)
      }
    }
  })

  it('carries the Weight Room tables a populated preview needs', () => {
    // Sets alone render a log with no sessions, no templates and no movement
    // names — which is what the preview deploy was actually showing.
    for (const required of [
      'weight_room_exercises',
      'weight_room_workouts',
      'weight_room_workout_templates',
      'weight_room_sets',
    ]) {
      expect(names).toContain(required)
    }
  })

  it('replaces the tables whose ids are seeded independently in each project', () => {
    // These carry `gen_random_uuid()` primary keys assigned by a migration that
    // both projects ran separately, so the same logical row has a different id
    // in each. An `id` upsert matches nothing; with no unique constraint on the
    // business key it then *inserts a duplicate* rather than failing loudly —
    // which is how staging ended up with 12 workout templates under 6 names.
    // Replace is also the only mode that carries production's ids across, which
    // `weight_room_sets` needs to resolve its slot and workout references.
    for (const name of [
      'weight_room_workout_templates',
      'weight_room_template_slots',
      'weight_room_template_slot_steps',
      'weight_room_template_alternates',
      'weight_room_workouts',
      'weight_room_goal_targets',
    ]) {
      const table = TABLES.find(t => t.name === name)
      expect(table, `${name} is missing from the manifest`).toBeDefined()
      expect(table?.mode, `${name} must be replaced, not upserted on id`).toBe('replace')
    }
  })

  it('syncs templates before the workouts that point at them', () => {
    // `weight_room_workouts.template_id` is `on delete set null`, so replacing
    // templates after the workouts land would blank every session's template.
    expect(names.indexOf('weight_room_workout_templates')).toBeLessThan(
      names.indexOf('weight_room_workouts')
    )
  })

  it('gives every table a conflict target or an explicit replace key', () => {
    for (const table of TABLES) {
      const hasKey =
        ('conflict' in table && typeof table.conflict === 'string') ||
        (table.mode === 'replace' && typeof table.key === 'string')
      expect(hasKey, `${table.name} has no upsert key`).toBe(true)
    }
  })
})
