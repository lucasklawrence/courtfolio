import { beforeEach, describe, expect, it, vi } from 'vitest'

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

beforeEach(() => generateStructured.mockReset())

describe('runPersonaPanel', () => {
  it('calls each persona on its family model and attaches identity', async () => {
    generateStructured.mockResolvedValue(verdictOutput())

    const verdicts = await runPersonaPanel(thesis, evidence, portfolioConfig)

    expect(verdicts).toHaveLength(portfolioConfig.personas.length)
    expect(verdicts.map(v => v.personaId)).toEqual(portfolioConfig.personas.map(p => p.id))

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
    const [v] = await runPersonaPanel(thesis, evidence, portfolioConfig)
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
    const [v] = await runPersonaPanel(thesis, evidence, portfolioConfig)
    expect(v.gaps[0].claimIndex).toBe(0)
    expect(v.standoutObservation).toBe('the sprint race')
  })
})
