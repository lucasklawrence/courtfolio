import { describe, expect, it, vi } from 'vitest'

const generateStructured = vi.fn()
vi.mock('./models', async importOriginal => ({
  ...(await importOriginal<typeof import('./models')>()),
  generateStructured: (args: unknown) => generateStructured(args),
}))

const { runPanel } = await import('./index')
const { portfolioConfig } = await import('./config')
const { textEvidence } = await import('./evidence/text-evidence')
const { personaVerdictSchema, verifyVerdictSchema, metaSynthesisSchema } = await import('./schemas')

const thesis = { targetId: 'courtfolio', claims: ['it stands out'] }
const evidence = textEvidence('courtfolio', 'Courtfolio', 'summary')

describe('runPanel (end-to-end orchestration, models mocked)', () => {
  it('wires personas → verify → synthesis and strips refuted gaps', async () => {
    let verifyCall = 0
    generateStructured.mockImplementation(({ schema }: { schema: unknown }) => {
      if (schema === personaVerdictSchema) {
        return Promise.resolve({
          scores: [
            { axisId: 'learning-value', score: 7, rationale: 'r' },
            { axisId: 'portfolio-signal', score: 6, rationale: 'r' },
          ],
          gaps: [
            { claimIndex: 0, claim: 'c', artifactShows: 'a', citation: 'file.ts', confidence: 0.7 },
          ],
          uncomfortableTruth: 'buries its signal',
          standoutObservation: null,
        })
      }
      if (schema === verifyVerdictSchema) {
        // Refute exactly the first gap verified; uphold the rest.
        const refuted = verifyCall++ === 0
        return Promise.resolve(
          refuted
            ? { verdict: 'refuted', verifyNote: 'claim is wrong' }
            : { verdict: 'upheld', verifyNote: 'backed' }
        )
      }
      if (schema === metaSynthesisSchema) {
        return Promise.resolve({
          convergence: [
            { finding: 'buries signal', personaIds: ['hiring-manager'], citations: ['file.ts'] },
          ],
          disagreements: [],
          robustFindings: ['theme hides depth'],
          topMoves: ['lead with the best room'],
          verdict: 'go',
        })
      }
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
  })

  it('rejects an invalid config before any model call', async () => {
    generateStructured.mockClear()
    await expect(runPanel(thesis, evidence, { ...portfolioConfig, axes: [] })).rejects.toThrow(
      /no axes/
    )
    expect(generateStructured).not.toHaveBeenCalled()
  })
})
