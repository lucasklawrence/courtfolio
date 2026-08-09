/**
 * Tests for the Shortcuts-export text parser (#400).
 *
 * Fixtures are excerpts of the real export, kept verbatim — including the
 * trailing spaces, the inline separator, and the blank lines that *are* empty
 * cells. Normalizing any of that would test a format the data doesn't have.
 */
import { describe, expect, it } from 'vitest'

import { parseExport, parseNoteBody, splitNotes } from './icloud-notes-text.mjs'

/** Two notes, the second separator running inline off the end of the first. */
const INLINE_SEPARATOR = [
  ' ===  Back Day 2| 2024-03-19=== ',
  '',
  'Barbell Bent Over Rows 4 sets',
  '',
  'Set',
  'Weight',
  'Reps',
  '1',
  '100',
  '10',
  '',
  'Workout pace: 35 min ===  Chest Day 2| 2024-03-18=== ',
  '',
  'Military Press 4 sets',
  'Set',
  'Weight',
  'Reps',
  '1',
  '55',
  '15',
].join('\n')

describe('splitNotes', () => {
  it('splits on the separator even when it runs inline off a previous note', () => {
    const notes = splitNotes(INLINE_SEPARATOR)
    expect(notes.map(n => `${n.title}|${n.date}`)).toEqual([
      'Back Day 2|2024-03-19',
      'Chest Day 2|2024-03-18',
    ])
  })

  it('trims the padding around the title', () => {
    expect(splitNotes(' ===  Legs Day 1| 2024-04-18=== \nPull ups')[0].title).toBe('Legs Day 1')
  })

  it('keeps a title that is not one of the six templates', () => {
    // The user's own warning: an untitled note takes its first line as a name.
    const notes = splitNotes(' ===  Nov 25| 2023-11-21=== \nBack Day 1\n')
    expect(notes[0].title).toBe('Nov 25')
  })

  it('returns nothing for input with no separators', () => {
    expect(splitNotes('just some text')).toEqual([])
    expect(splitNotes(undefined as unknown as string)).toEqual([])
  })
})

describe('parseNoteBody — tables', () => {
  // Verbatim from Back Day 1, 2024-04-16.
  const backDay1 = [
    'Pull ups 4 sets',
    'Set',
    'Weight',
    'Reps',
    '1',
    'BW',
    '6',
    '2',
    'BW',
    '6',
    '10',
    'BW',
    '',
    '11',
    'BW',
    '',
    'Seated two arm Row 4 sets',
    'Set',
    'Weight',
    'Reps',
    '1',
    '110',
    '15',
    '2',
    '120',
    '15',
  ].join('\n')

  it('reads a blank third cell as an empty measure, not a missing row', () => {
    // Set 10 is BW for *no recorded reps*. Dropping the blank line would slide
    // set 11's number into set 10's reps and invent a set of 11.
    const { exercises } = parseNoteBody(backDay1)
    const pullups = exercises[0]
    expect(pullups.name).toBe('Pull ups')
    expect(pullups.declared).toBe('4 sets')
    expect(pullups.sets).toEqual([
      { set: 1, weight: 'BW', reps: '6' },
      { set: 2, weight: 'BW', reps: '6' },
      { set: 10, weight: 'BW', reps: '' },
      { set: 11, weight: 'BW', reps: '' },
    ])
  })

  it('starts a new exercise when the rows stop', () => {
    const { exercises } = parseNoteBody(backDay1)
    expect(exercises.map(e => e.name)).toEqual(['Pull ups', 'Seated two arm Row'])
    expect(exercises[1].sets).toHaveLength(2)
  })

  it('captures the weight header verbatim, including (total)', () => {
    // The sharpest trap in the source: a combined two-dumbbell load.
    const { exercises } = parseNoteBody(
      ['Incline barbell press 4 sets', 'Set', 'Weight (total)', 'Reps', '1', '115', '8'].join('\n')
    )
    expect(exercises[0].weight_header).toBe('Weight (total)')
  })

  it('captures a third column that is not reps', () => {
    // Walking lunges count steps; planks record seconds. Calling either "reps"
    // would put a step count into the rep total.
    const lunges = parseNoteBody(
      ['Walking Lunges 4 sets ', '', 'Set', 'Weight', 'Steps', '1', 'BW', '20'].join('\n')
    )
    expect(lunges.exercises[0].measure_header).toBe('Steps')

    const planks = parseNoteBody(
      ['Planks 4 sets', '', 'Set', 'Weight', 'Time (seconds)', '1', 'BW', '30'].join('\n')
    )
    expect(planks.exercises[0].measure_header).toBe('Time (seconds)')
  })

  it('handles a pluralized Sets header', () => {
    const { exercises } = parseNoteBody(
      ['Knee Tucks 4 sets', '', 'Sets', 'Weight', 'Reps', '1', 'Hanging Knee tuck', '10'].join('\n')
    )
    expect(exercises[0].name).toBe('Knee Tucks')
    expect(exercises[0].sets[0].weight).toBe('Hanging Knee tuck')
  })

  it('steps over a qualifier line between the heading and the table', () => {
    // `Machine` / `Barbell` / `Did cable curl` describe the movement without
    // being its name; taking the nearest line would name the exercise "Machine".
    const { exercises } = parseNoteBody(
      ['Preacher curls 5 sets', 'Machine', 'Set', 'Weight', 'Reps', '1', '95', '10'].join('\n')
    )
    expect(exercises[0].name).toBe('Preacher curls')
    expect(exercises[0].note).toBe('Machine')
  })

  it('tolerates trailing spaces in headings and headers', () => {
    const { exercises } = parseNoteBody(
      ['Military press ', 'Set ', 'Weight ', 'Reps', '1', '55', '15'].join('\n')
    )
    expect(exercises[0].name).toBe('Military press')
    expect(exercises[0].declared).toBeNull()
  })
})

describe('parseNoteBody — rep lists and freeform', () => {
  it('reads a bare number list as grease-the-groove volume', () => {
    const { rep_lists, exercises } = parseNoteBody(['Pushups', '10', '10', '12', ''].join('\n'))
    expect(exercises).toHaveLength(0)
    expect(rep_lists).toEqual([{ movement: 'Pushups', reps: [10, 10, 12] }])
  })

  it('reads the older weight - reps shorthand as a real exercise', () => {
    // Pre-table notes logged `180 - 15`; those are loaded sets, not volume.
    const { exercises, rep_lists } = parseNoteBody(
      ['Leg press', '180 - 15', '270 - 12', '270 - 12'].join('\n')
    )
    expect(rep_lists).toHaveLength(0)
    expect(exercises[0].name).toBe('Leg press')
    expect(exercises[0].sets).toEqual([
      { set: 1, weight: '180', reps: '15' },
      { set: 2, weight: '270', reps: '12' },
      { set: 3, weight: '270', reps: '12' },
    ])
  })

  it('keeps prose out of both piles', () => {
    const { loose_text, rep_lists, exercises } = parseNoteBody(
      ['Rack Run 35,30,25,20 2 sets', '', 'Set 1: 25, 20, 10', '', 'Workout pace: 35 min'].join(
        '\n'
      )
    )
    expect(exercises).toHaveLength(0)
    expect(rep_lists).toHaveLength(0)
    expect(loose_text).toContain('Workout pace: 35 min')
  })

  it('does not mistake a table it already consumed for a rep list', () => {
    const { rep_lists } = parseNoteBody(
      ['Squats 5 sets', 'Set', 'Weight', 'Reps', '1', '95', '10', '2', '115', '10'].join('\n')
    )
    expect(rep_lists).toHaveLength(0)
  })
})

describe('parseExport', () => {
  it('produces one entry per note, shaped for the movement parser', () => {
    const parsed = parseExport(INLINE_SEPARATOR)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toMatchObject({ title: 'Back Day 2', date: '2024-03-19' })
    expect(parsed[0].exercises[0].name).toBe('Barbell Bent Over Rows')
    expect(parsed[1].exercises[0].name).toBe('Military Press')
  })
})
