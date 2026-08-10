/**
 * Tests for per-template aggregation (#446).
 *
 * The cases that matter are the ones where the template and the log disagree:
 * a movement that ran but is no longer prescribed, one prescribed but never
 * run, and a session whose "duration" measures note-taking rather than
 * training. Getting any of those wrong makes the page quietly wrong rather
 * than visibly broken.
 */
import { describe, expect, it } from 'vitest'

import type { WorkoutTemplate } from '@/types/weight-room'

import {
  buildTemplateHistory,
  resolveTemplate,
  templateRunIds,
  templateSlug,
} from './template-history'
import type { WorkoutHistoryEntry } from './workout-stats'

/** A template with the given prescribed movements. */
function template(id: string, name: string, exercises: string[], position = 0): WorkoutTemplate {
  return {
    id,
    name,
    position,
    slots: exercises.map((exercise, i) => ({
      id: `${id}-slot-${i}`,
      position: i,
      exercise,
      target_sets: 3,
      steps: [],
      alternates: [],
    })),
  }
}

/** A history entry for one run, with a per-exercise breakdown. */
function run(
  id: string,
  templateId: string,
  startedAt: string,
  breakdown: { exercise: string; sets: number; reps: number; tonnage: number }[],
  options: { source?: 'manual' | 'apple_health' | 'icloud_notes'; minutes?: number | null } = {}
): WorkoutHistoryEntry {
  const { source = 'apple_health', minutes = 45 } = options
  return {
    workout: { id, started_at: startedAt, template_id: templateId, source },
    summary: {
      durationMinutes: minutes,
      tonnage: breakdown.reduce((n, b) => n + b.tonnage, 0),
      totalSets: breakdown.reduce((n, b) => n + b.sets, 0),
      totalReps: breakdown.reduce((n, b) => n + b.reps, 0),
      exercises: breakdown,
    },
  } as unknown as WorkoutHistoryEntry
}

const CHEST = template('t-chest', 'Chest Day 1', ['barbell-bench-press', 'sled-push'])

describe('templateSlug', () => {
  it('lowercases and hyphenates', () => {
    expect(templateSlug('Chest Day 1')).toBe('chest-day-1')
  })

  it('drops apostrophes rather than turning them into separators', () => {
    expect(templateSlug("Farmer's Day")).toBe('farmers-day')
  })

  it('trims separator runs at both ends', () => {
    expect(templateSlug('  Legs / Day 2!  ')).toBe('legs-day-2')
  })
})

describe('resolveTemplate', () => {
  const templates = [template('t-a', 'Chest Day 1', [], 1), template('t-b', 'Legs Day 2', [], 2)]

  it('finds a template by its derived slug', () => {
    expect(resolveTemplate('chest-day-1', templates)?.id).toBe('t-a')
  })

  it('falls back to the raw id, so a renamed template stays addressable', () => {
    expect(resolveTemplate('t-b', templates)?.id).toBe('t-b')
  })

  it('is null for a segment matching neither', () => {
    expect(resolveTemplate('nope', templates)).toBeNull()
  })

  it('breaks a slug collision by position, not by fetch order', () => {
    const collide = [
      template('t-late', 'Chest Day 1', [], 5),
      template('t-early', 'Chest Day 1', [], 2),
    ]
    expect(resolveTemplate('chest-day-1', collide)?.id).toBe('t-early')
    // The loser is still reachable by id.
    expect(resolveTemplate('t-late', collide)?.id).toBe('t-late')
  })
})

describe('buildTemplateHistory', () => {
  it('keeps only this template’s runs, oldest first', () => {
    const history = buildTemplateHistory(CHEST, [
      run('w2', 't-chest', '2024-03-02T18:00:00Z', [
        { exercise: 'barbell-bench-press', sets: 3, reps: 24, tonnage: 4000 },
      ]),
      run('w-other', 't-legs', '2024-03-03T18:00:00Z', [
        { exercise: 'leg-press', sets: 3, reps: 30, tonnage: 9000 },
      ]),
      run('w1', 't-chest', '2024-01-05T18:00:00Z', [
        { exercise: 'barbell-bench-press', sets: 3, reps: 21, tonnage: 3600 },
      ]),
    ])
    expect(history.runs.map(r => r.workoutId)).toEqual(['w1', 'w2'])
    expect(history.firstDayKey).toBe('2024-01-05')
    expect(history.lastDayKey).toBe('2024-03-02')
  })

  it('keeps a movement that ran but is no longer prescribed, and marks it', () => {
    // The drift case: fifteen movements in the real log ran under templates
    // that have since dropped them. Deriving panels from the current slots
    // would erase them the day someone edits a template.
    const history = buildTemplateHistory(CHEST, [
      run('w1', 't-chest', '2024-01-05T18:00:00Z', [
        { exercise: 'barbell-bench-press', sets: 3, reps: 21, tonnage: 3600 },
        { exercise: 'barbell-overhead-press', sets: 3, reps: 18, tonnage: 1800 },
      ]),
    ])
    const overhead = history.movements.find(m => m.exercise === 'barbell-overhead-press')
    expect(overhead).toBeDefined()
    expect(overhead?.prescribed).toBe(false)
    expect(history.movements.find(m => m.exercise === 'barbell-bench-press')?.prescribed).toBe(true)
  })

  it('reports a prescribed movement that has never been logged', () => {
    const history = buildTemplateHistory(CHEST, [
      run('w1', 't-chest', '2024-01-05T18:00:00Z', [
        { exercise: 'barbell-bench-press', sets: 3, reps: 21, tonnage: 3600 },
      ]),
    ])
    expect(history.neverRun).toEqual(['sled-push'])
  })

  it('totals a movement across every run and orders by tonnage', () => {
    const history = buildTemplateHistory(CHEST, [
      run('w1', 't-chest', '2024-01-05T18:00:00Z', [
        { exercise: 'barbell-bench-press', sets: 3, reps: 21, tonnage: 3600 },
        { exercise: 'cable-fly', sets: 3, reps: 30, tonnage: 900 },
      ]),
      run('w2', 't-chest', '2024-01-12T18:00:00Z', [
        { exercise: 'barbell-bench-press', sets: 4, reps: 28, tonnage: 5000 },
      ]),
    ])
    const bench = history.movements[0]
    expect(bench.exercise).toBe('barbell-bench-press')
    expect(bench).toMatchObject({ runs: 2, sets: 7, reps: 49, tonnage: 8600 })
    expect(history.movements[1].exercise).toBe('cable-fly')
  })

  it('excludes an icloud_notes session from the duration series but not the run series', () => {
    // Its start and end are the note's create and edit times, so the "duration"
    // measures typing. It is still a real session and still counts everywhere
    // else.
    const history = buildTemplateHistory(CHEST, [
      run(
        'w-notes',
        't-chest',
        '2024-01-05T18:00:00Z',
        [{ exercise: 'barbell-bench-press', sets: 3, reps: 21, tonnage: 3600 }],
        { source: 'icloud_notes', minutes: 27 }
      ),
      run(
        'w-watch',
        't-chest',
        '2024-01-12T18:00:00Z',
        [{ exercise: 'barbell-bench-press', sets: 3, reps: 21, tonnage: 3600 }],
        { source: 'apple_health', minutes: 52 }
      ),
    ])
    expect(history.runs.map(r => r.workoutId)).toEqual(['w-notes', 'w-watch'])
    expect(history.durations.map(r => r.workoutId)).toEqual(['w-watch'])
  })

  it('excludes a session with no duration at all', () => {
    const history = buildTemplateHistory(CHEST, [
      run('w1', 't-chest', '2024-01-05T18:00:00Z', [], { minutes: null }),
    ])
    expect(history.runs).toHaveLength(1)
    expect(history.durations).toHaveLength(0)
  })

  it('buckets a run on its Pacific day, not its UTC one', () => {
    // 2024-01-06 03:00 UTC is still Jan 5 in Pacific.
    const history = buildTemplateHistory(CHEST, [run('w1', 't-chest', '2024-01-06T03:00:00Z', [])])
    expect(history.runs[0].dayKey).toBe('2024-01-05')
  })

  it('is empty but well-formed for a template never run', () => {
    const history = buildTemplateHistory(CHEST, [])
    expect(history.runs).toEqual([])
    expect(history.movements).toEqual([])
    expect(history.firstDayKey).toBe('')
    expect(history.neverRun).toEqual(['barbell-bench-press', 'sled-push'])
  })
})

describe('templateRunIds', () => {
  it('collects the sessions that ran the template', () => {
    const history = buildTemplateHistory(CHEST, [
      run('w1', 't-chest', '2024-01-05T18:00:00Z', []),
      run('w2', 't-chest', '2024-01-12T18:00:00Z', []),
    ])
    expect([...templateRunIds(history)].sort()).toEqual(['w1', 'w2'])
  })
})
