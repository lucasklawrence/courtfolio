import { describe, expect, it } from 'vitest'

import {
  WeightRoomAchievementCreateSchema,
  WeightRoomAchievementUpdateSchema,
  WeightRoomExerciseRowSchema,
  WeightRoomExerciseUpdateSchema,
  WeightRoomExerciseUpsertSchema,
  WeightRoomGoalRowSchema,
  WeightRoomGoalUpsertSchema,
  WeightRoomMonthlyFocusCreateSchema,
  WeightRoomMonthlyFocusRowSchema,
  WeightRoomSetCreateSchema,
  WeightRoomSetRowSchema,
  WeightRoomWorkoutCreateSchema,
  WeightRoomWorkoutUpdateSchema,
  WorkoutPrescriptionSchema,
  exerciseRowToWeightRoomExercise,
  prescriptionToTemplate,
  setRowToStrengthSet,
  templateToPrescription,
} from './weight-room'

import type { WorkoutTemplate } from '@/types/weight-room'

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

  it('rejects load_multiplier, which moved to the exercise catalog (#373)', () => {
    // `.strict()` turns the moved column into a loud failure rather than a
    // silently-ignored key, which is what would let the two sides drift.
    expect(() => WeightRoomGoalRowSchema.parse({ ...base, load_multiplier: 2 })).toThrow()
  })
})

describe('WeightRoomExerciseRowSchema (read, #373)', () => {
  const base = {
    slug: 'barbell-bench-press',
    display_name: 'Barbell Bench Press',
    equipment: 'barbell',
    muscle_group: 'chest',
  }

  it('accepts a row carrying only the not-null columns', () => {
    expect(WeightRoomExerciseRowSchema.parse(base)).toEqual(base)
  })

  it('preserves DB casing on read, matching every sibling row schema', () => {
    const parsed = WeightRoomExerciseRowSchema.parse({ ...base, slug: 'Barbell-Bench-Press' })
    expect(parsed.slug).toBe('Barbell-Bench-Press')
  })

  it('accepts null optionals (a fixture or a pre-default row)', () => {
    expect(() =>
      WeightRoomExerciseRowSchema.parse({
        ...base,
        load_multiplier: null,
        is_unilateral: null,
        archived: null,
      })
    ).not.toThrow()
  })

  it('rejects an equipment or muscle_group outside the check constraint', () => {
    expect(() => WeightRoomExerciseRowSchema.parse({ ...base, equipment: 'trebuchet' })).toThrow()
    expect(() => WeightRoomExerciseRowSchema.parse({ ...base, muscle_group: 'lats' })).toThrow()
  })

  it('rejects a non-positive load_multiplier', () => {
    expect(() => WeightRoomExerciseRowSchema.parse({ ...base, load_multiplier: 0 })).toThrow()
  })
})

describe('exerciseRowToWeightRoomExercise (row → public shape)', () => {
  const base = {
    slug: 'dips',
    display_name: 'Dips',
    equipment: 'bodyweight' as const,
    muscle_group: 'chest' as const,
  }

  it('omits null optionals so read sites apply their documented defaults', () => {
    const converted = exerciseRowToWeightRoomExercise({
      ...base,
      load_multiplier: null,
      is_unilateral: null,
      archived: null,
    })
    expect(converted).toEqual(base)
  })

  it('carries through the values that are actually set', () => {
    const converted = exerciseRowToWeightRoomExercise({
      ...base,
      load_multiplier: 2,
      is_unilateral: true,
      archived: true,
    })
    expect(converted).toMatchObject({
      load_multiplier: 2,
      is_unilateral: true,
      archived: true,
    })
  })
})

describe('WeightRoomExerciseUpsertSchema (write body, #373)', () => {
  const base = {
    slug: 'barbell-bench-press',
    display_name: 'Barbell Bench Press',
    equipment: 'barbell',
    muscle_group: 'chest',
  }

  it('lowercases the slug so the roster cannot grow case-divergent duplicates', () => {
    // Two rows for one movement would split its history across both — the
    // same anti-duplicate reasoning as the goals upsert.
    const parsed = WeightRoomExerciseUpsertSchema.parse({ ...base, slug: 'Barbell-Bench-Press' })
    expect(parsed.slug).toBe('barbell-bench-press')
  })

  it('defaults load_multiplier to 1 and both flags to false', () => {
    const parsed = WeightRoomExerciseUpsertSchema.parse(base)
    expect(parsed).toMatchObject({
      load_multiplier: 1,
      is_unilateral: false,
      archived: false,
    })
  })

  it('trims the display name and rejects an empty one', () => {
    expect(
      WeightRoomExerciseUpsertSchema.parse({ ...base, display_name: '  Dips  ' }).display_name
    ).toBe('Dips')
    expect(() => WeightRoomExerciseUpsertSchema.parse({ ...base, display_name: '   ' })).toThrow()
  })

  it('rejects an unknown key', () => {
    expect(() => WeightRoomExerciseUpsertSchema.parse({ ...base, muscle: 'chest' })).toThrow()
  })
})

describe('WeightRoomExerciseUpdateSchema (patch body, #373)', () => {
  it('accepts a single-field patch — archiving without restating the row', () => {
    expect(WeightRoomExerciseUpdateSchema.parse({ archived: true })).toEqual({
      archived: true,
    })
  })

  it('injects no defaults for omitted keys', () => {
    // Zod 4 applies `.default()` to a missing key even inside `.partial()`,
    // so a patch schema derived from a defaulted create schema would reset
    // load_multiplier to 1 and un-archive the row on every label edit.
    const parsed = WeightRoomExerciseUpdateSchema.parse({ display_name: 'Dips' })
    expect(Object.keys(parsed)).toEqual(['display_name'])
  })

  it('rejects an empty patch', () => {
    expect(() => WeightRoomExerciseUpdateSchema.parse({})).toThrow()
  })

  it('rejects a slug change — the value is stored on every logged set', () => {
    expect(() => WeightRoomExerciseUpdateSchema.parse({ slug: 'renamed' })).toThrow()
  })
})

describe('WeightRoomWorkoutCreateSchema (write body, #374)', () => {
  it('accepts an empty body — the common case is just tapping start', () => {
    expect(() => WeightRoomWorkoutCreateSchema.parse({})).not.toThrow()
  })

  it('normalizes an empty title to undefined so the column is omitted', () => {
    // On create, "" means "I didn't supply one" — the DB default of null is
    // the right outcome, not an empty string the read side must special-case.
    expect(WeightRoomWorkoutCreateSchema.parse({ title: '   ' }).title).toBeUndefined()
  })

  it('trims a supplied title', () => {
    expect(WeightRoomWorkoutCreateSchema.parse({ title: '  Push Day  ' }).title).toBe('Push Day')
  })

  it('rejects a location outside the check constraint', () => {
    expect(() => WeightRoomWorkoutCreateSchema.parse({ location: 'moon' })).toThrow()
  })

  it('rejects an over-long title', () => {
    expect(() => WeightRoomWorkoutCreateSchema.parse({ title: 'x'.repeat(81) })).toThrow()
  })

  it('rejects an unknown key', () => {
    expect(() => WeightRoomWorkoutCreateSchema.parse({ duration: 60 })).toThrow()
  })
})

describe('WeightRoomWorkoutUpdateSchema (patch body, #374)', () => {
  it('rejects an empty patch', () => {
    // The field transforms materialize every key, so this can only be caught
    // by inspecting values — a keys-length check would wave `{}` straight
    // through and issue an update that changes nothing but `updated_at`.
    expect(() => WeightRoomWorkoutUpdateSchema.parse({})).toThrow()
  })

  it('distinguishes clearing a title from leaving it alone', () => {
    // Clearing writes null; omitting must stay undefined so the route can
    // strip it and leave the stored value intact.
    expect(WeightRoomWorkoutUpdateSchema.parse({ title: '' }).title).toBeNull()
    expect(WeightRoomWorkoutUpdateSchema.parse({ notes: 'x' }).title).toBeUndefined()
  })

  it('accepts ended_at: null to reopen a session', () => {
    expect(WeightRoomWorkoutUpdateSchema.parse({ ended_at: null }).ended_at).toBeNull()
  })

  it('accepts an ISO ended_at to close one', () => {
    expect(WeightRoomWorkoutUpdateSchema.parse({ ended_at: '2026-07-15T19:00:00Z' }).ended_at).toBe(
      '2026-07-15T19:00:00Z'
    )
  })
})

describe('WeightRoomSetCreateSchema — session membership (#374)', () => {
  const base = { exercise: 'pushups', reps: 20 }

  it('accepts a workout_id and a 0-based position', () => {
    const parsed = WeightRoomSetCreateSchema.parse({
      ...base,
      workout_id: '11111111-1111-4111-8111-111111111111',
      position: 0,
    })
    expect(parsed.position).toBe(0)
  })

  it('still accepts a loose set with neither', () => {
    const parsed = WeightRoomSetCreateSchema.parse(base)
    expect(parsed).not.toHaveProperty('workout_id')
  })

  it('rejects a non-uuid workout_id and a negative position', () => {
    expect(() => WeightRoomSetCreateSchema.parse({ ...base, workout_id: 'w1' })).toThrow()
    expect(() => WeightRoomSetCreateSchema.parse({ ...base, position: -1 })).toThrow()
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
      })
    ).toThrow()
  })

  it('rejects unknown fields via .strict()', () => {
    expect(() =>
      WeightRoomGoalUpsertSchema.parse({
        exercise: 'pushups',
        daily_target: 100,
        color: '#EA580C',
        surprise: 'no',
      })
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
      WeightRoomSetCreateSchema.parse({ exercise: 'pushups', reps: 25, surprise: 'no' })
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
    expect(() => WeightRoomMonthlyFocusCreateSchema.parse({ ...base, category: 'core' })).toThrow()
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
      })
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
    expect(WeightRoomAchievementCreateSchema.parse({ ...base, exercise: 'PushUps' })).toMatchObject(
      {
        exercise: 'pushups',
      }
    )
  })

  it('rejects a non-positive threshold and an unknown measure', () => {
    expect(() => WeightRoomAchievementCreateSchema.parse({ ...base, threshold: 0 })).toThrow()
    expect(() =>
      WeightRoomAchievementCreateSchema.parse({ ...base, measure: 'calories' })
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

describe('workout prescription snapshots (#377)', () => {
  const template: WorkoutTemplate = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Chest Day 1',
    position: 0,
    slots: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        position: 1,
        exercise: 'incline-dumbbell-press',
        target_sets: 4,
        target_reps: 10,
        steps: [],
        alternates: [],
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        position: 0,
        exercise: 'barbell-bench-press',
        target_sets: 4,
        target_sets_max: 5,
        target_reps: 8,
        target_reps_max: 10,
        target_weight_lbs: 155,
        notes: 'pause at the bottom',
        steps: [{ id: '44444444-4444-4444-8444-444444444444', position: 0, target_reps: 5 }],
        alternates: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            exercise: 'dumbbell-bench-press',
            position: 0,
          },
        ],
      },
    ],
  }

  it('captures every prescribing field', () => {
    const snapshot = templateToPrescription(template)
    const bench = snapshot.slots.find(s => s.exercise === 'barbell-bench-press')
    expect(bench).toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      position: 0,
      exercise: 'barbell-bench-press',
      target_sets: 4,
      target_sets_max: 5,
      target_reps: 8,
      target_reps_max: 10,
      target_weight_lbs: 155,
      notes: 'pause at the bottom',
    })
  })

  it('orders slots by position rather than trusting load order', () => {
    expect(templateToPrescription(template).slots.map(s => s.position)).toEqual([0, 1])
  })

  it('keeps slot ids, which are the join key for template_slot_id', () => {
    const snapshot = templateToPrescription(template)
    expect(snapshot.slots.map(s => s.id).sort()).toEqual(template.slots.map(s => s.id).sort())
  })

  it('validates as jsonb the read path will accept', () => {
    const snapshot = templateToPrescription(template)
    // Round-trip through JSON: this is stored in a jsonb column, so anything
    // that doesn't survive serialization is a bug that only shows up in prod.
    expect(WorkoutPrescriptionSchema.safeParse(JSON.parse(JSON.stringify(snapshot))).success).toBe(
      true
    )
  })

  it('rejects an unknown field, so a new TemplateSlot column cannot slip in unvalidated', () => {
    const snapshot = templateToPrescription(template)
    const tampered = {
      ...snapshot,
      slots: [{ ...snapshot.slots[0], rest_seconds: 90 }],
    }
    expect(WorkoutPrescriptionSchema.safeParse(tampered).success).toBe(false)
  })

  it('round-trips into a template the adherence math can score', () => {
    const rehydrated = prescriptionToTemplate(templateToPrescription(template))
    expect(rehydrated.name).toBe('Chest Day 1')
    expect(rehydrated.slots).toHaveLength(2)
    // Never captured, so they come back empty rather than stale.
    expect(rehydrated.slots.every(s => s.steps.length === 0)).toBe(true)
    expect(rehydrated.slots.every(s => s.alternates.length === 0)).toBe(true)
  })

  it('is unaffected by a later edit to the source template — the whole point', () => {
    const snapshot = templateToPrescription(template)
    // The template is edited afterwards: the bench slot becomes 6 sets of a
    // different movement, and the template is renamed.
    const edited: WorkoutTemplate = {
      ...template,
      name: 'Chest Day 1 (v2)',
      slots: template.slots.map(s =>
        s.exercise === 'barbell-bench-press'
          ? { ...s, exercise: 'dumbbell-bench-press', target_sets: 6 }
          : s
      ),
    }
    const rehydrated = prescriptionToTemplate(snapshot)
    const bench = rehydrated.slots.find(s => s.id === '33333333-3333-4333-8333-333333333333')
    expect(bench?.exercise).toBe('barbell-bench-press')
    expect(bench?.target_sets).toBe(4)
    expect(rehydrated.name).toBe('Chest Day 1')
    // And the edit is real — this isn't passing because nothing changed.
    expect(edited.slots.find(s => s.id === bench?.id)?.target_sets).toBe(6)
  })
})
