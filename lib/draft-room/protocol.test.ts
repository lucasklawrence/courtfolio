// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type {
  MetaSynthesis,
  PanelResult,
  PersonaVerdict,
  Thesis,
  VerifiedGap,
} from '@/lib/panel/types'

import { resultToEvents, type ResultToEventsOptions } from './protocol'

/**
 * Tests resultToEvents — the single replay path shared by the cache-hit route
 * branch and the e2e stub. The contract under test: a stored PanelResult is
 * replayed as the exact frame sequence a live run would have produced.
 */

const thesis: Thesis = {
  targetId: 'courtfolio',
  claims: ['claim zero', 'claim one'],
}

function makeVerdict(personaId: string, label: string): PersonaVerdict {
  return {
    personaId,
    label,
    scores: [{ axisId: 'learning-value', score: 7, rationale: 'r' }],
    gaps: [],
    uncomfortableTruth: 'truth',
  }
}

const verifiedGaps: VerifiedGap[] = [
  {
    claim: 'gap zero',
    artifactShows: 'x',
    citation: 'a.ts',
    confidence: 0.8,
    personaId: 'hiring-manager',
    gapIndex: 0,
    verdict: 'upheld',
    verifyNote: 'n0',
  },
  {
    claim: 'gap one',
    artifactShows: 'y',
    citation: 'b.ts',
    confidence: 0.6,
    personaId: 'staff-mentor',
    gapIndex: 1,
    verdict: 'refuted',
    verifyNote: 'n1',
  },
]

const synthesis: MetaSynthesis = {
  targetId: 'courtfolio',
  scoreboard: [],
  convergence: [],
  disagreements: [],
  robustFindings: ['finding'],
  topMoves: ['move'],
  caughtErrors: [],
  verdict: 'bottom line',
}

const result: PanelResult = {
  thesis,
  verdicts: [makeVerdict('hiring-manager', 'HM'), makeVerdict('staff-mentor', 'SM')],
  verifiedGaps,
  synthesis,
}

const opts: ResultToEventsOptions = {
  cached: true,
  startedAt: '2026-07-10T00:00:00.000Z',
  modelByPersonaId: {
    'hiring-manager': 'anthropic/claude-haiku-4.5',
    'staff-mentor': 'openai/gpt-5.1-instant',
  },
  lensByPersonaId: {
    'hiring-manager': 'lens-hm',
    'staff-mentor': 'lens-sm',
  },
}

describe('resultToEvents', () => {
  it('opens with a run-start carrying the thesis, honesty metadata, and the roster built from verdicts', () => {
    const events = resultToEvents(result, opts)

    expect(events[0]).toEqual({
      type: 'run-start',
      targetId: 'courtfolio',
      thesis,
      personas: [
        { id: 'hiring-manager', label: 'HM', lens: 'lens-hm', model: 'anthropic/claude-haiku-4.5' },
        { id: 'staff-mentor', label: 'SM', lens: 'lens-sm', model: 'openai/gpt-5.1-instant' },
      ],
      cached: true,
      startedAt: '2026-07-10T00:00:00.000Z',
    })
  })

  it('falls back to empty strings for personas missing from the model/lens maps', () => {
    const events = resultToEvents(result, {
      ...opts,
      modelByPersonaId: {},
      lensByPersonaId: {},
    })

    const first = events[0]
    if (first.type !== 'run-start') throw new Error('expected run-start first')
    expect(first.personas.map(p => p.model)).toEqual(['', ''])
    expect(first.personas.map(p => p.lens)).toEqual(['', ''])
  })

  it('replays the full live sequence in order, including recorded persona errors', () => {
    const degraded: PanelResult = {
      ...result,
      personaFailures: [{ personaId: 'skeptical-peer', errorType: 'TypeError' }],
    }

    const events = resultToEvents(degraded, opts)

    expect(events.map(e => e.type)).toEqual([
      'run-start',
      'persona-verdict',
      'persona-verdict',
      'persona-error',
      'verify-start',
      'gap-verified',
      'gap-verified',
      'gaps-verified',
      'synthesis',
      'done',
    ])
    expect(events[1]).toEqual({ type: 'persona-verdict', verdict: result.verdicts[0] })
    expect(events[2]).toEqual({ type: 'persona-verdict', verdict: result.verdicts[1] })
    expect(events[3]).toEqual({
      type: 'persona-error',
      personaId: 'skeptical-peer',
      errorType: 'TypeError',
    })
  })

  it('emits no persona-error frames when personaFailures is absent', () => {
    const events = resultToEvents(result, opts)
    expect(events.some(e => e.type === 'persona-error')).toBe(false)
  })

  it('announces verify-start with the full gap count, then one progressing gap-verified per gap', () => {
    const events = resultToEvents(result, opts)

    expect(events.find(e => e.type === 'verify-start')).toEqual({
      type: 'verify-start',
      gapCount: result.verifiedGaps.length,
    })

    const gapEvents = events.filter(e => e.type === 'gap-verified')
    expect(gapEvents).toEqual([
      {
        type: 'gap-verified',
        personaId: 'hiring-manager',
        gapIndex: 0,
        verdict: 'upheld',
        done: 1,
        total: 2,
      },
      {
        type: 'gap-verified',
        personaId: 'staff-mentor',
        gapIndex: 1,
        verdict: 'refuted',
        done: 2,
        total: 2,
      },
    ])

    expect(events.find(e => e.type === 'gaps-verified')).toEqual({
      type: 'gaps-verified',
      verifiedGaps: result.verifiedGaps,
    })
  })

  it('carries the synthesis verbatim, then terminates with done at elapsedMs 0 (replay)', () => {
    const events = resultToEvents(result, opts)

    const synthEvent = events.find(e => e.type === 'synthesis')
    if (!synthEvent || synthEvent.type !== 'synthesis') throw new Error('expected synthesis event')
    expect(synthEvent.synthesis).toBe(result.synthesis)

    expect(events[events.length - 1]).toEqual({ type: 'done', elapsedMs: 0 })
  })

  it('still emits the verify bracket (count 0, empty rulings) when there are no gaps', () => {
    const gapless: PanelResult = { ...result, verifiedGaps: [] }

    const events = resultToEvents(gapless, opts)

    expect(events.map(e => e.type)).toEqual([
      'run-start',
      'persona-verdict',
      'persona-verdict',
      'verify-start',
      'gaps-verified',
      'synthesis',
      'done',
    ])
    expect(events.find(e => e.type === 'verify-start')).toEqual({ type: 'verify-start', gapCount: 0 })
    expect(events.find(e => e.type === 'gaps-verified')).toEqual({
      type: 'gaps-verified',
      verifiedGaps: [],
    })
  })
})
