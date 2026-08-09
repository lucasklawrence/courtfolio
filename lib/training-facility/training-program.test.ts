/**
 * Tests for the training-programme summary (#436).
 *
 * The cases pin the two things that would quietly mislead: reading a rotation
 * out of sessions that have none, and reporting adherence against an order the
 * log never followed. The rotation fixture is the real one — Chest 1 → Back 1 →
 * Legs 1 → Chest 2 → Back 2 → Legs 2 — which is deliberately *not* the order
 * `weight_room_workout_templates.position` lists the six in.
 */
import { describe, expect, it } from 'vitest'

import type { WeightRoomWorkout, WorkoutTemplate } from '@/types/weight-room'

import { buildProgramSummary, inferRotation, rotationAdherence } from './training-program'

/** The six templates, in the order the catalog lists them (not the rotation). */
const TEMPLATES: WorkoutTemplate[] = [
  'Chest Day 1',
  'Chest Day 2',
  'Back Day 1',
  'Back Day 2',
  'Legs Day 1',
  'Legs Day 2',
].map((name, index) => ({
  id: `t${index}`,
  name,
  position: index,
  archived: false,
  slots: [],
}))

const ID_BY_NAME = new Map(TEMPLATES.map(t => [t.name, t.id]))

/** The cycle the sessions actually record. */
const CYCLE = ['Chest Day 1', 'Back Day 1', 'Legs Day 1', 'Chest Day 2', 'Back Day 2', 'Legs Day 2']

/** A templated session on a given day, optionally with a duration. */
function session(name: string, dayKey: string, minutes?: number): WeightRoomWorkout {
  const started = `${dayKey}T18:00:00Z`
  return {
    id: `${name}-${dayKey}`,
    started_at: started,
    template_id: ID_BY_NAME.get(name) as string,
    ...(minutes === undefined
      ? {}
      : { ended_at: new Date(Date.parse(started) + minutes * 60_000).toISOString() }),
  } as WeightRoomWorkout
}

/** `n` full turns of the cycle, one session every two days from 2023-01-02. */
function cycleSessions(turns: number): WeightRoomWorkout[] {
  const out: WeightRoomWorkout[] = []
  let day = Date.parse('2023-01-02T00:00:00Z')
  for (let turn = 0; turn < turns; turn += 1) {
    for (const name of CYCLE) {
      out.push(session(name, new Date(day).toISOString().slice(0, 10)))
      day += 2 * 86_400_000
    }
  }
  return out
}

describe('inferRotation', () => {
  it('reads the cycle out of the order sessions were run', () => {
    const sequence = [...CYCLE, ...CYCLE, ...CYCLE]
    expect(inferRotation(sequence)).toEqual(CYCLE)
  })

  it('ignores the catalog position order, which is not the rotation', () => {
    // Positions list them Chest 1, Chest 2, Back 1, Back 2, Legs 1, Legs 2.
    // The log says otherwise, and the log wins.
    const inferred = inferRotation([...CYCLE, ...CYCLE])
    expect(inferred).not.toEqual(TEMPLATES.map(t => t.name))
    expect(inferred).toEqual(CYCLE)
  })

  it('outvotes the occasional deviation rather than breaking the chain', () => {
    // One repeated day and one skip, in a log that otherwise cycles.
    const sequence = [...CYCLE, 'Chest Day 1', 'Chest Day 1', ...CYCLE, ...CYCLE]
    expect(inferRotation(sequence)).toEqual(CYCLE)
  })

  it('treats a genuine two-template alternation as the cycle it is', () => {
    // A → B → A is a rotation of period two, not noise.
    expect(inferRotation(['A', 'B', 'A', 'B'])).toEqual(['A', 'B'])
  })

  it('returns nothing when the chain never closes into a cycle', () => {
    // A → B → C → nowhere. Reporting a partial chain would make adherence
    // measure against an order the log never repeated.
    expect(inferRotation(['A', 'B', 'C'])).toEqual([])
  })

  it('starts the cycle where the log starts, not alphabetically', () => {
    // A cycle has no inherent beginning; showing it from the first session
    // matches the order someone scrolling the log actually meets.
    expect(inferRotation([...CYCLE, ...CYCLE])[0]).toBe('Chest Day 1')
    const startedElsewhere = [...CYCLE.slice(2), ...CYCLE, ...CYCLE]
    expect(inferRotation(startedElsewhere)[0]).toBe('Legs Day 1')
  })

  it('returns nothing for too few sessions to show an order', () => {
    expect(inferRotation([])).toEqual([])
    expect(inferRotation(['Chest Day 1'])).toEqual([])
  })
})

describe('rotationAdherence', () => {
  it('scores a perfectly followed cycle at 1', () => {
    const result = rotationAdherence([...CYCLE, ...CYCLE], CYCLE)
    expect(result.followed).toBe(result.total)
    expect(result.rate).toBe(1)
  })

  it('counts a deviation against the rate', () => {
    // Six transitions, one of which skips Back Day 1.
    const sequence = ['Chest Day 1', 'Legs Day 1', 'Chest Day 2', 'Back Day 2']
    const result = rotationAdherence(sequence, CYCLE)
    expect(result.total).toBe(3)
    expect(result.followed).toBe(2)
    expect(result.rate).toBeCloseTo(2 / 3)
  })

  it('is zero rather than NaN when there is no rotation', () => {
    expect(rotationAdherence(CYCLE, [])).toEqual({ followed: 0, total: 0, rate: 0 })
    expect(rotationAdherence([], CYCLE)).toEqual({ followed: 0, total: 0, rate: 0 })
  })
})

describe('buildProgramSummary', () => {
  it('summarizes templates in rotation order, not catalog order', () => {
    const summary = buildProgramSummary(cycleSessions(3), TEMPLATES)
    expect(summary?.templates.map(t => t.name)).toEqual(CYCLE)
    expect(summary?.totalSessions).toBe(18)
    expect(summary?.adherence.rate).toBe(1)
  })

  it('ignores sessions with no template', () => {
    // The current era is untemplated grease-the-groove; folding it in would
    // dilute both cadence and adherence.
    const untemplated = {
      id: 'loose',
      started_at: '2026-06-01T18:00:00Z',
    } as WeightRoomWorkout
    const summary = buildProgramSummary([...cycleSessions(2), untemplated], TEMPLATES)
    expect(summary?.totalSessions).toBe(12)
    expect(summary?.lastDayKey?.startsWith('2023')).toBe(true)
  })

  it('returns null when nothing names a template', () => {
    const loose = { id: 'a', started_at: '2026-06-01T18:00:00Z' } as WeightRoomWorkout
    expect(buildProgramSummary([loose], TEMPLATES)).toBeNull()
  })

  it('takes the median session length, so one forgotten stop cannot redefine it', () => {
    const sessions = [
      session('Back Day 1', '2023-01-02', 40),
      session('Back Day 1', '2023-01-09', 44),
      // Watch left running.
      session('Back Day 1', '2023-01-16', 600),
    ]
    const summary = buildProgramSummary(sessions, TEMPLATES)
    expect(summary?.templates[0].medianMinutes).toBe(44)
  })

  it('leaves the duration absent when no session was ever timed', () => {
    const summary = buildProgramSummary(
      [session('Back Day 1', '2023-01-02'), session('Back Day 1', '2023-01-09')],
      TEMPLATES
    )
    expect(summary?.templates[0].medianMinutes).toBeNull()
  })

  it('includes months with no sessions, so a layoff renders as one', () => {
    const sessions = [session('Chest Day 1', '2023-01-10'), session('Back Day 1', '2023-04-10')]
    const summary = buildProgramSummary(sessions, TEMPLATES)
    expect(summary?.months.map(m => m.monthKey)).toEqual([
      '2023-01',
      '2023-02',
      '2023-03',
      '2023-04',
    ])
    expect(summary?.months.map(m => m.sessions)).toEqual([1, 0, 0, 1])
  })

  it('reports the span of templated training', () => {
    // 12 sessions, one every two days from 2023-01-02.
    const summary = buildProgramSummary(cycleSessions(2), TEMPLATES)
    expect(summary?.firstDayKey).toBe('2023-01-02')
    expect(summary?.lastDayKey).toBe('2023-01-24')
  })
})
