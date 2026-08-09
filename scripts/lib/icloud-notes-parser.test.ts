/**
 * Tests for the iCloud Notes workout parser (#400).
 *
 * The cases pin the four ways this import can quietly record the wrong thing:
 * a `Weight (total)` column halved (or not) against the movement's implement
 * count, a bodyweight `Squats` rep list landing on the barbell movement (or the
 * reverse), the templates' unused rows importing as sets that never happened,
 * and a re-run duplicating two years of history because the keys moved.
 */
import { describe, expect, it } from 'vitest'

import {
  isPerformedSet,
  isSessionNote,
  mintImportKey,
  templateNameForNote,
  parseLabelledBlock,
  TWENTY_ONES_REPS_PER_ARM,
  normalizeName,
  parseNote,
  parseNoteDate,
  perImplementWeight,
  resolveRepListMovement,
  resolveTableMovement,
} from './icloud-notes-parser.mjs'

describe('parseNoteDate', () => {
  it('reads the US short date the iCloud list renders', () => {
    expect(parseNoteDate('4/16/24')).toBe('2024-04-16')
    expect(parseNoteDate('12/4/23')).toBe('2023-12-04')
    expect(parseNoteDate('04/16/2024')).toBe('2024-04-16')
  })

  it('passes an already-normalized date through', () => {
    expect(parseNoteDate('2024-04-16')).toBe('2024-04-16')
  })

  it('returns null for the relative labels iCloud shows on recent notes', () => {
    // "Yesterday" and "11:22 AM" appear against notes from the last few days.
    // Guessing a date for those would file a session on the wrong day.
    expect(parseNoteDate('Yesterday')).toBeNull()
    expect(parseNoteDate('11:22 AM')).toBeNull()
    expect(parseNoteDate('')).toBeNull()
  })

  it('rejects an impossible month or day', () => {
    expect(parseNoteDate('13/1/24')).toBeNull()
    expect(parseNoteDate('4/32/24')).toBeNull()
  })
})

describe('normalizeName', () => {
  it('collapses case, spacing, punctuation and a trailing plural to one key', () => {
    const expected = normalizeName('Barbell Bent Over Row')
    expect(normalizeName('barbell bent-over rows')).toBe(expected)
    expect(normalizeName('BARBELL  BENT OVER ROWS')).toBe(expected)
  })

  it('returns an empty key for a non-string', () => {
    expect(normalizeName(undefined as unknown as string)).toBe('')
  })
})

describe('resolveTableMovement', () => {
  it('maps the wordings that differ from the catalog slug', () => {
    // Resolved during #375's template pass; reused rather than re-derived.
    expect(resolveTableMovement('Military press')).toBe('barbell-overhead-press')
    expect(resolveTableMovement('DB Flat Press')).toBe('dumbbell-bench-press')
    expect(resolveTableMovement('Seated two arm Row')).toBe('seated-cable-row')
    expect(resolveTableMovement('One arm DB Row')).toBe('dumbbell-row')
    expect(resolveTableMovement('RDL Barbell')).toBe('barbell-romanian-deadlift')
    expect(resolveTableMovement('Tricep Pressdowns')).toBe('cable-tricep-pushdown')
  })

  it('sends a loaded Squats table to the barbell movement, not the bodyweight ring', () => {
    // #400: mapping gym squats onto `squats` dumps them into the 100/day
    // grease-the-groove ring and corrupts that streak.
    expect(resolveTableMovement('Squats')).toBe('barbell-back-squat')
  })

  it('returns null rather than guessing at an unknown movement', () => {
    expect(resolveTableMovement('Rack Run')).toBeNull()
  })
})

describe('resolveRepListMovement', () => {
  it('sends a bare Squats rep list to the bodyweight movement', () => {
    // Same word, opposite answer from the table case — the shape it was
    // written in is the discriminator, not the name.
    expect(resolveRepListMovement('Squats')).toBe('squats')
    expect(resolveTableMovement('Squats')).toBe('barbell-back-squat')
  })

  it('falls through to the table mapping for movements outside the GTG set', () => {
    expect(resolveRepListMovement('Lat Pulldowns')).toBe('lat-pulldown')
  })
})

describe('perImplementWeight', () => {
  it('halves a (total) column on a two-implement movement', () => {
    // The sharpest trap in the source data: 37.5 total is 18.75 per hand, and
    // storing 37.5 records double the real load with nothing looking wrong.
    expect(perImplementWeight(37.5, 'Weight (total)', 'dumbbell-incline-press')).toBe(18.75)
  })

  it('leaves a plain Weight column alone on the same movement', () => {
    expect(perImplementWeight(40, 'Weight', 'dumbbell-incline-press')).toBe(40)
  })

  it('leaves a (total) column alone on a single-implement movement', () => {
    // A barbell is one implement; "total" and "per implement" are the same
    // number, and halving would invent a load that was never lifted.
    expect(perImplementWeight(135, 'Weight (total)', 'barbell-bench-press')).toBe(135)
    expect(perImplementWeight(50, 'Weight (total)', 'dumbbell-row')).toBe(50)
  })

  it('prefers the live catalog multiplier over the built-in fallback', () => {
    expect(perImplementWeight(60, 'Weight (total)', 'shrugs', 2)).toBe(30)
    expect(perImplementWeight(60, 'Weight (total)', 'shrugs', 1)).toBe(60)
  })

  it('treats BW and blanks as unloaded', () => {
    expect(perImplementWeight('BW', 'Weight', 'pullups')).toBeNull()
    expect(perImplementWeight('bw', 'Weight', 'pullups')).toBeNull()
    expect(perImplementWeight('', 'Weight', 'pullups')).toBeNull()
    expect(perImplementWeight(null, 'Weight', 'pullups')).toBeNull()
  })

  it('reads a number out of a handwritten cell', () => {
    expect(perImplementWeight('135 lb', 'Weight', 'barbell-bench-press')).toBe(135)
    expect(perImplementWeight('22.5 DB', 'Weight', 'dumbbell-curl')).toBe(22.5)
  })

  it('is case- and space-insensitive about the (total) marker', () => {
    expect(perImplementWeight(50, 'Weight ( TOTAL )', 'dumbbell-curl')).toBe(25)
  })
})

describe('isPerformedSet', () => {
  it('keeps a row with reps', () => {
    expect(isPerformedSet({ set: 1, weight: 'BW', reps: 6 })).toBe(true)
  })

  it('drops the templates unused rows', () => {
    // A `Pull ups 4 sets` table runs to eighteen numbered rows with BW
    // pre-filled and Reps blank. Those are stationery, not training.
    expect(isPerformedSet({ set: 12, weight: 'BW', reps: null })).toBe(false)
    expect(isPerformedSet({ set: 13, weight: null, reps: null })).toBe(false)
    expect(isPerformedSet({ set: 14, weight: 'BW', reps: 0 })).toBe(false)
  })
})

describe('parseNote', () => {
  const note = {
    title: 'Chest Day 1',
    date: '2024-03-05',
    exercises: [
      {
        name: 'Barbell Bench Press',
        weight_header: 'Weight',
        sets: [
          { set: 1, weight: 95, reps: 12 },
          { set: 2, weight: 135, reps: 10 },
          { set: 3, weight: null, reps: null },
        ],
      },
      {
        name: 'Incline DB press',
        weight_header: 'Weight (total)',
        sets: [{ set: 1, weight: 37.5, reps: 10 }],
      },
      { name: 'Rack Run', weight_header: 'Weight', sets: [{ set: 1, weight: 30, reps: 8 }] },
    ],
    rep_lists: [{ movement: 'Pull ups', reps: [8, 8, 7, 6] }],
  }

  it('separates session work from grease-the-groove volume', () => {
    // #400: the rep lists appear under nearly every session note without
    // belonging to it, so they must not inherit the workout.
    const { sets } = parseNote(note)
    const workout = sets.filter(set => set.disposition === 'workout')
    const gtg = sets.filter(set => set.disposition === 'gtg')

    expect(workout.map(set => set.exercise)).toEqual([
      'barbell-bench-press',
      'barbell-bench-press',
      'dumbbell-incline-press',
    ])
    expect(gtg).toHaveLength(4)
    expect(gtg.every(set => set.exercise === 'pullups')).toBe(true)
    expect(gtg.every(set => set.position === null)).toBe(true)
  })

  it('applies the (total) halving through the full parse', () => {
    const { sets } = parseNote(note)
    const incline = sets.find(set => set.exercise === 'dumbbell-incline-press')
    expect(incline?.weight_lbs).toBe(18.75)
  })

  it('numbers workout sets consecutively across movements', () => {
    const { sets } = parseNote(note)
    const positions = sets.filter(set => set.disposition === 'workout').map(set => set.position)
    expect(positions).toEqual([0, 1, 2])
  })

  it('reports an unmapped movement instead of inventing a slug', () => {
    const { unmapped } = parseNote(note)
    expect(unmapped).toEqual(['Rack Run'])
  })

  it('mints stable keys, and keeps a rep list from colliding with its own table', () => {
    // Chest Day 2 has push-ups in both shapes on one day; without the `gtg:`
    // qualifier the two would upsert over each other.
    const both = parseNote({
      title: 'Chest Day 2',
      date: '2024-03-12',
      exercises: [
        { name: 'Push ups', weight_header: 'Weight', sets: [{ set: 1, weight: 'BW', reps: 20 }] },
      ],
      rep_lists: [{ movement: 'Push ups', reps: [10] }],
    })

    const keys = both.sets.map(set => set.import_key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('icloud:Chest Day 2:2024-03-12:pushups:0')
    expect(keys).toContain('icloud:Chest Day 2:2024-03-12:gtg:pushups:0')
  })

  it('produces identical keys on a re-run so the import converges', () => {
    expect(parseNote(note).sets.map(s => s.import_key)).toEqual(
      parseNote(note).sets.map(s => s.import_key)
    )
  })

  it('survives a note with neither tables nor rep lists', () => {
    expect(parseNote({ title: 'Back Day 1', date: '2024-04-16' })).toEqual({
      sets: [],
      unmapped: [],
      timed: [],
    })
  })
})

describe('isSessionNote', () => {
  it('rejects the Strength Cycle programme document', () => {
    // All six templates in one note, revised 2022-2025. Imported as a session
    // it became one 30-minute workout of 163 sets and 1,523 reps.
    expect(isSessionNote('Strength Cycle')).toBe(false)
    expect(isSessionNote('  strength cycle  ')).toBe(false)
  })

  it('accepts real session notes', () => {
    expect(isSessionNote('Back Day 1')).toBe(true)
    expect(isSessionNote('Pull ups')).toBe(true)
  })
})

describe('templateNameForNote', () => {
  it('resolves the six seeded templates from their note titles', () => {
    expect(templateNameForNote('Back Day 1')).toBe('Back Day 1')
    expect(templateNameForNote('Chest Day 2')).toBe('Chest Day 2')
    expect(templateNameForNote('Legs Day 2')).toBe('Legs Day 2')
  })

  it('folds the Leg Day 2 spelling onto Legs Day 2', () => {
    // Three sessions in early 2023 drop the plural.
    expect(templateNameForNote('Leg Day 2')).toBe('Legs Day 2')
  })

  it('is case-insensitive about the title', () => {
    expect(templateNameForNote('chest day 1')).toBe('Chest Day 1')
  })

  it('leaves genuinely untemplated notes unlinked', () => {
    // Standalone pull-up, leg-press and plyo days were never in the rotation;
    // forcing them onto the nearest template would invent adherence.
    expect(templateNameForNote('Pull ups')).toBeNull()
    expect(templateNameForNote('Workout')).toBeNull()
    expect(templateNameForNote('Leg press')).toBeNull()
    expect(templateNameForNote('Nov 25')).toBeNull()
  })
})

describe('parseLabelledBlock', () => {
  it('turns a rack run into one to-failure set per drop', () => {
    // `25, 20, 10` is three drops down the rack, each taken to failure with
    // the rep count never written down.
    const sets = parseLabelledBlock({
      movement: 'Rack Run',
      planned: '35,30,25,20',
      sets: [{ set: 1, value: '25, 20, 10' }],
    })
    expect(sets).toEqual([
      { exercise: 'dumbbell-curl', reps: 1, weight_lbs: 25, variant: 'rack run', to_failure: true },
      { exercise: 'dumbbell-curl', reps: 1, weight_lbs: 20, variant: 'rack run', to_failure: true },
      { exercise: 'dumbbell-curl', reps: 1, weight_lbs: 10, variant: 'rack run', to_failure: true },
    ])
  })

  it('records an empty Set N: as one unloaded to-failure set', () => {
    // The set was declared and labelled, so it happened — it just recorded
    // nothing. Dropping it would lose that the movement was performed at all.
    const sets = parseLabelledBlock({
      movement: 'Rack Run',
      planned: '35,30,25,20',
      sets: [{ set: 1, value: '' }],
    })
    expect(sets).toEqual([
      {
        exercise: 'dumbbell-curl',
        reps: 1,
        weight_lbs: null,
        variant: 'rack run',
        to_failure: true,
      },
    ])
  })

  it('never takes loads from the planned rack in the heading', () => {
    // `35,30,25,20` is what was intended; the body is what was done, and they
    // routinely disagree.
    const sets = parseLabelledBlock({
      movement: 'Rack Run',
      planned: '35,30,25,20',
      sets: [{ set: 1, value: '25, 20, 10' }],
    })
    expect(sets.map(s => s.weight_lbs)).toEqual([25, 20, 10])
  })

  it('stores 21s at 14 reps — the per-arm count, not the 21 total', () => {
    // 7 one arm, 7 the other, 7 both: 21 curls but 14 per arm. Every other
    // dumbbell set stores reps per arm and doubles for tonnage, so 21 here
    // would bill 42 arm-reps for work that was 28.
    const sets = parseLabelledBlock({
      movement: '21s',
      sets: [{ set: 1, value: '22.5 DB' }],
    })
    expect(sets).toEqual([
      { exercise: 'dumbbell-curl', reps: 14, weight_lbs: 22.5, variant: '21s' },
    ])
    expect(TWENTY_ONES_REPS_PER_ARM).toBe(14)
  })

  it('keeps a 21s set whose load was never written', () => {
    // `Set 1: DB` names the implement without a weight.
    const sets = parseLabelledBlock({ movement: '21s', sets: [{ set: 1, value: 'DB' }] })
    expect(sets).toEqual([
      { exercise: 'dumbbell-curl', reps: 14, weight_lbs: null, variant: '21s' },
    ])
  })

  it('does not mark 21s as to-failure — its rep count is known', () => {
    const sets = parseLabelledBlock({ movement: '21s', sets: [{ set: 1, value: '20 DB' }] })
    expect(sets[0].to_failure).toBeUndefined()
  })
})

describe('parseNote — labelled blocks', () => {
  it('imports rack runs alongside the note’s tables, with unique keys', () => {
    const { sets } = parseNote({
      title: 'Back Day 1',
      date: '2024-03-15',
      exercises: [
        {
          name: 'EZ curl standing',
          weight_header: 'Weight',
          measure_header: 'Reps',
          sets: [{ set: 1, weight: 70, reps: 12 }],
        },
      ],
      labelled_blocks: [
        { movement: 'Rack Run', planned: '35,30,25,20', sets: [{ set: 1, value: '25, 20' }] },
      ],
    })

    const rack = sets.filter(s => s.variant === 'rack run')
    expect(rack).toHaveLength(2)
    expect(rack.every(s => s.to_failure === true)).toBe(true)
    // Keys index per movement across the whole note, so two drops never collide.
    expect(new Set(sets.map(s => s.import_key)).size).toBe(sets.length)
  })
})

describe('mintImportKey', () => {
  it('is fully determined by the note identity and the set position', () => {
    expect(
      mintImportKey({ title: 'Back Day 1', date: '2024-04-16', slug: 'pullups', index: 2 })
    ).toBe('icloud:Back Day 1:2024-04-16:pullups:2')
  })
})
