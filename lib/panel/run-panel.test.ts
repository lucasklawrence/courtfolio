import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PanelEvent, PersonaVerdict } from './types'

const generateStructured = vi.fn()
vi.mock('./models', async importOriginal => ({
  ...(await importOriginal<typeof import('./models')>()),
  generateStructured: (args: unknown) => generateStructured(args),
}))

const { runPersonaPanel } = await import('./run-panel')
const { portfolioConfig } = await import('./config')
const { textEvidence } = await import('./evidence/text-evidence')

const thesis = { targetId: 't', claims: ['claim a'] }
const evidence = textEvidence('t', 'T', 'summary')

function verdictOutput(over: Record<string, unknown> = {}) {
  return {
    scores: [{ axisId: 'learning-value', score: 6, rationale: 'r' }],
    gaps: [{ claimIndex: 0, claim: 'c', artifactShows: 'a', citation: 'f.ts', confidence: 0.8 }],
    uncomfortableTruth: 'truth',
    standoutObservation: null,
    ...over,
  }
}

// Braces matter: `mockReset()` returns the mock, and a function returned from
// `beforeEach` is treated as a cleanup hook — vitest would then invoke the mock
// itself (arg-less) after every test.
beforeEach(() => {
  generateStructured.mockReset()
})

describe('runPersonaPanel', () => {
  it('calls each persona on its family model and attaches identity', async () => {
    generateStructured.mockResolvedValue(verdictOutput())

    const { verdicts, failures } = await runPersonaPanel(thesis, evidence, portfolioConfig)

    expect(verdicts).toHaveLength(portfolioConfig.personas.length)
    expect(verdicts.map(v => v.personaId)).toEqual(portfolioConfig.personas.map(p => p.id))
    expect(failures).toEqual([])

    const modelsCalled = generateStructured.mock.calls.map(c => c[0].model)
    for (const persona of portfolioConfig.personas) {
      expect(modelsCalled).toContain(portfolioConfig.lineup.personas[persona.family])
    }
  })

  it('drops a null claimIndex and a null standoutObservation rather than carrying nulls', async () => {
    generateStructured.mockResolvedValue(
      verdictOutput({
        gaps: [
          { claimIndex: null, claim: 'c', artifactShows: 'a', citation: 'f.ts', confidence: 0.8 },
        ],
      })
    )
    const {
      verdicts: [v],
    } = await runPersonaPanel(thesis, evidence, portfolioConfig)
    expect(v.gaps[0]).not.toHaveProperty('claimIndex') // null index omitted
    expect(v).not.toHaveProperty('standoutObservation')
  })

  it('keeps a real claimIndex and standout when present', async () => {
    generateStructured.mockResolvedValue(
      verdictOutput({
        standoutObservation: 'the sprint race',
        gaps: [{ claimIndex: 0, claim: 'c', artifactShows: 'a', citation: 'f', confidence: 0.5 }],
      })
    )
    const {
      verdicts: [v],
    } = await runPersonaPanel(thesis, evidence, portfolioConfig)
    expect(v.gaps[0].claimIndex).toBe(0)
    expect(v.standoutObservation).toBe('the sprint race')
  })

  it('benches a failed persona (with a persona-error event) and keeps survivors in config order', async () => {
    const failing = portfolioConfig.personas.find(p => p.family === 'openai')!
    generateStructured.mockImplementation(({ model }: { model: string }) =>
      model === portfolioConfig.lineup.personas[failing.family]
        ? Promise.reject(new TypeError('vendor down'))
        : Promise.resolve(verdictOutput())
    )

    const events: PanelEvent[] = []
    const { verdicts, failures } = await runPersonaPanel(thesis, evidence, portfolioConfig, {
      onEvent: e => events.push(e),
    })

    expect(failures).toEqual([{ personaId: failing.id, errorType: 'TypeError' }])
    expect(verdicts.map(v => v.personaId)).toEqual(
      portfolioConfig.personas.filter(p => p.id !== failing.id).map(p => p.id)
    )
    expect(events).toContainEqual({
      type: 'persona-error',
      personaId: failing.id,
      errorType: 'TypeError',
    })
  })

  it('emits one complete persona-verdict event per success', async () => {
    generateStructured.mockResolvedValue(verdictOutput())

    const events: PanelEvent[] = []
    const { verdicts } = await runPersonaPanel(thesis, evidence, portfolioConfig, {
      onEvent: e => events.push(e),
    })

    const verdictEvents = events.filter(
      (e): e is Extract<PanelEvent, { type: 'persona-verdict' }> => e.type === 'persona-verdict'
    )
    expect(verdictEvents).toHaveLength(verdicts.length)
    const byId = (a: PersonaVerdict, b: PersonaVerdict) => a.personaId.localeCompare(b.personaId)
    expect([...verdictEvents.map(e => e.verdict)].sort(byId)).toEqual([...verdicts].sort(byId))
    // Each event payload is the complete verdict, not a partial.
    for (const e of verdictEvents) {
      expect(e.verdict.scores).toEqual(verdictOutput().scores)
      expect(e.verdict.gaps).toHaveLength(1)
      expect(e.verdict.uncomfortableTruth).toBe('truth')
      expect(e.verdict.label).toBeTruthy()
    }
  })

  it('a throwing listener does not break the run', async () => {
    generateStructured.mockResolvedValue(verdictOutput())

    const { verdicts, failures } = await runPersonaPanel(thesis, evidence, portfolioConfig, {
      onEvent: () => {
        throw new Error('listener bug')
      },
    })

    expect(verdicts).toHaveLength(portfolioConfig.personas.length)
    expect(failures).toEqual([])
  })

  it('propagates an abort instead of benching', async () => {
    const ac = new AbortController()
    ac.abort()
    generateStructured.mockRejectedValue(new DOMException('run aborted', 'AbortError'))

    const events: PanelEvent[] = []
    await expect(
      runPersonaPanel(thesis, evidence, portfolioConfig, {
        signal: ac.signal,
        onEvent: e => events.push(e),
      })
    ).rejects.toMatchObject({ name: 'AbortError' })
    // An aborted run is not a degraded run — nobody was benched.
    expect(events.filter(e => e.type === 'persona-error')).toHaveLength(0)
  })

  it('forwards the persona token cap and signal to every model call', async () => {
    generateStructured.mockResolvedValue(verdictOutput())
    const config = { ...portfolioConfig, limits: { personaMaxOutputTokens: 2000 } }
    const ac = new AbortController()

    await runPersonaPanel(thesis, evidence, config, { signal: ac.signal })

    expect(generateStructured).toHaveBeenCalledTimes(config.personas.length)
    for (const call of generateStructured.mock.calls) {
      expect(call[0].maxOutputTokens).toBe(2000)
      expect(call[0].signal).toBe(ac.signal)
    }
  })
})
