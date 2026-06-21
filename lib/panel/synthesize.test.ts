import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersonaVerdict } from './types'

const generateStructured = vi.fn()
vi.mock('./models', async importOriginal => ({
  ...(await importOriginal<typeof import('./models')>()),
  generateStructured: (args: unknown) => generateStructured(args),
}))

const { synthesize, buildScoreboard } = await import('./synthesize')
const { portfolioConfig } = await import('./config')

const verdicts: PersonaVerdict[] = [
  {
    personaId: 'a',
    label: 'A',
    scores: [{ axisId: 'learning-value', score: 8, rationale: 'r' }],
    gaps: [],
    uncomfortableTruth: 't',
  },
  {
    personaId: 'b',
    label: 'B',
    scores: [{ axisId: 'learning-value', score: 6, rationale: 'r' }],
    gaps: [],
    uncomfortableTruth: 't',
  },
]

describe('buildScoreboard', () => {
  it('projects verdicts to id/label/scores without model involvement', () => {
    expect(buildScoreboard(verdicts)).toEqual([
      { personaId: 'a', label: 'A', scores: verdicts[0].scores },
      { personaId: 'b', label: 'B', scores: verdicts[1].scores },
    ])
  })
})

describe('synthesize', () => {
  beforeEach(() => generateStructured.mockReset())

  it('runs the meta-judge model and returns its body', async () => {
    const body = {
      convergence: [],
      disagreements: [],
      robustFindings: ['r'],
      topMoves: ['m'],
      verdict: 'v',
    }
    generateStructured.mockResolvedValueOnce(body)

    const out = await synthesize({ targetId: 't', claims: ['c'] }, verdicts, '', portfolioConfig)

    expect(out).toBe(body)
    expect(generateStructured.mock.calls[0][0].model).toBe(portfolioConfig.lineup.metaJudge)
  })
})
