import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PanelEvent } from './types'

const generateStructured = vi.fn()
vi.mock('./models', async importOriginal => ({
  ...(await importOriginal<typeof import('./models')>()),
  generateStructured: (args: unknown) => generateStructured(args),
}))

const { runPanel, PanelDegradedError } = await import('./index')
const { portfolioConfig } = await import('./config')
const { textEvidence } = await import('./evidence/text-evidence')
const { personaVerdictSchema, verifyVerdictSchema, metaSynthesisSchema } = await import('./schemas')

const thesis = { targetId: 'courtfolio', claims: ['it stands out'] }
const evidence = textEvidence('courtfolio', 'Courtfolio', 'summary')

function personaOutput() {
  return {
    scores: [
      { axisId: 'learning-value', score: 7, rationale: 'r' },
      { axisId: 'portfolio-signal', score: 6, rationale: 'r' },
    ],
    gaps: [
      { claimIndex: 0, claim: 'c', artifactShows: 'a', citation: 'file.ts', confidence: 0.7 },
    ],
    uncomfortableTruth: 'buries its signal',
    standoutObservation: null,
  }
}

function synthesisBody() {
  return {
    convergence: [
      { finding: 'buries signal', personaIds: ['hiring-manager'], citations: ['file.ts'] },
    ],
    disagreements: [],
    robustFindings: ['theme hides depth'],
    topMoves: ['lead with the best room'],
    verdict: 'go',
  }
}

/** Mock every stage as healthy: personas report, verifier upholds, judge synthesizes. */
function mockCleanRun() {
  generateStructured.mockImplementation(({ schema }: { schema: unknown }) => {
    if (schema === personaVerdictSchema) return Promise.resolve(personaOutput())
    if (schema === verifyVerdictSchema)
      return Promise.resolve({ verdict: 'upheld', verifyNote: 'backed' })
    if (schema === metaSynthesisSchema) return Promise.resolve(synthesisBody())
    return Promise.reject(new Error('unexpected schema'))
  })
}

// Braces matter: `mockReset()` returns the mock, and a function returned from
// `beforeEach` is treated as a cleanup hook — vitest would then invoke the mock
// itself (arg-less) after every test.
beforeEach(() => {
  generateStructured.mockReset()
})

describe('runPanel (end-to-end orchestration, models mocked)', () => {
  it('wires personas → verify → synthesis and strips refuted gaps', async () => {
    let verifyCall = 0
    generateStructured.mockImplementation(({ schema }: { schema: unknown }) => {
      if (schema === personaVerdictSchema) return Promise.resolve(personaOutput())
      if (schema === verifyVerdictSchema) {
        // Refute exactly the first gap verified; uphold the rest.
        const refuted = verifyCall++ === 0
        return Promise.resolve(
          refuted
            ? { verdict: 'refuted', verifyNote: 'claim is wrong' }
            : { verdict: 'upheld', verifyNote: 'backed' }
        )
      }
      if (schema === metaSynthesisSchema) return Promise.resolve(synthesisBody())
      throw new Error('unexpected schema')
    })

    const result = await runPanel(thesis, evidence, portfolioConfig)

    // One verdict per persona.
    expect(result.verdicts).toHaveLength(portfolioConfig.personas.length)
    // One verified gap per persona gap.
    expect(result.verifiedGaps).toHaveLength(portfolioConfig.personas.length)
    // Exactly one refuted → exactly one caught error, surfaced not hidden.
    expect(result.synthesis.caughtErrors).toHaveLength(1)
    expect(result.synthesis.caughtErrors[0].verifyNote).toBe('claim is wrong')
    // Scoreboard is built deterministically from verdicts.
    expect(result.synthesis.scoreboard.map(s => s.personaId)).toEqual(
      portfolioConfig.personas.map(p => p.id)
    )
    // Meta-judge body passed through.
    expect(result.synthesis.targetId).toBe('courtfolio')
    expect(result.synthesis.robustFindings).toContain('theme hides depth')
    // A whole panel reports no failures.
    expect(result).not.toHaveProperty('personaFailures')
  })

  it('rejects an invalid config before any model call', async () => {
    await expect(runPanel(thesis, evidence, { ...portfolioConfig, axes: [] })).rejects.toThrow(
      /no axes/
    )
    expect(generateStructured).not.toHaveBeenCalled()
  })

  it('rejects with PanelDegradedError before any verify spend when survivors < minSurvivors', async () => {
    const survivor = portfolioConfig.personas.find(p => p.family === 'anthropic')!
    generateStructured.mockImplementation(
      ({ schema, model }: { schema: unknown; model: string }) => {
        if (schema !== personaVerdictSchema)
          return Promise.reject(new Error('stages beyond personas must not run'))
        return model === portfolioConfig.lineup.personas[survivor.family]
          ? Promise.resolve(personaOutput())
          : Promise.reject(new TypeError('vendor down'))
      }
    )

    const err: unknown = await runPanel(thesis, evidence, portfolioConfig, {
      minSurvivors: 2,
    }).then(() => null, (e: unknown) => e)

    expect(err).toBeInstanceOf(PanelDegradedError)
    if (!(err instanceof PanelDegradedError)) throw new Error('unreachable')
    expect(err.verdicts.map(v => v.personaId)).toEqual([survivor.id])
    expect(err.failures.map(f => f.personaId)).toEqual(
      portfolioConfig.personas.filter(p => p.id !== survivor.id).map(p => p.id)
    )
    expect(err.failures.every(f => f.errorType === 'TypeError')).toBe(true)
    // No verify or synthesis spend after the floor fails.
    expect(generateStructured.mock.calls.some(c => c[0].schema === verifyVerdictSchema)).toBe(false)
    expect(generateStructured.mock.calls.some(c => c[0].schema === metaSynthesisSchema)).toBe(false)
  })

  it('records the failure and tells the meta-judge on a degraded-but-passing run', async () => {
    const benched = portfolioConfig.personas.find(p => p.family === 'google')!
    generateStructured.mockImplementation(
      ({ schema, model }: { schema: unknown; model: string }) => {
        if (schema === personaVerdictSchema) {
          return model === portfolioConfig.lineup.personas[benched.family]
            ? Promise.reject(new TypeError('vendor down'))
            : Promise.resolve(personaOutput())
        }
        if (schema === verifyVerdictSchema)
          return Promise.resolve({ verdict: 'upheld', verifyNote: 'backed' })
        if (schema === metaSynthesisSchema) return Promise.resolve(synthesisBody())
        return Promise.reject(new Error('unexpected schema'))
      }
    )

    const result = await runPanel(thesis, evidence, portfolioConfig)

    expect(result.personaFailures).toEqual([{ personaId: benched.id, errorType: 'TypeError' }])
    expect(result.verdicts.map(v => v.personaId)).toEqual(
      portfolioConfig.personas.filter(p => p.id !== benched.id).map(p => p.id)
    )
    // The meta-judge is told about the missing voice, not left to invent it.
    const synthArgs = generateStructured.mock.calls.find(
      c => c[0].schema === metaSynthesisSchema
    )![0]
    expect(synthArgs.prompt).toContain('## Panel note')
    expect(synthArgs.prompt).toContain(benched.id)
  })

  it('emits the full event sequence in pipeline order on a clean run', async () => {
    mockCleanRun()

    const events: PanelEvent[] = []
    await runPanel(thesis, evidence, portfolioConfig, { onEvent: e => events.push(e) })

    const n = portfolioConfig.personas.length // one gap per persona in this mock
    expect(events.map(e => e.type)).toEqual([
      ...Array<string>(n).fill('persona-verdict'),
      'verify-start',
      ...Array<string>(n).fill('gap-verified'),
      'gaps-verified',
    ])
    const gapEvents = events.filter(
      (e): e is Extract<PanelEvent, { type: 'gap-verified' }> => e.type === 'gap-verified'
    )
    expect(gapEvents.map(e => e.done)).toEqual(Array.from({ length: n }, (_, i) => i + 1))
    expect(gapEvents.every(e => e.total === n)).toBe(true)
  })
})
