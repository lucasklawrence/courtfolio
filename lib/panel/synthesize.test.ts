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
  // Braces matter: `mockReset()` returns the mock, and a function returned
  // from `beforeEach` is treated as a cleanup hook — vitest would then invoke
  // the mock itself (arg-less) after every test.
  beforeEach(() => {
    generateStructured.mockReset()
  })

  const body = {
    convergence: [],
    disagreements: [],
    robustFindings: ['r'],
    topMoves: ['m'],
    verdict: 'v',
  }

  it('runs the meta-judge model and returns its body', async () => {
    generateStructured.mockResolvedValueOnce(body)

    const out = await synthesize({ targetId: 't', claims: ['c'] }, verdicts, '', portfolioConfig)

    expect(out).toBe(body)
    expect(generateStructured.mock.calls[0][0].model).toBe(portfolioConfig.lineup.metaJudge)
  })

  it('forwards the meta-judge token cap and signal to the model call', async () => {
    generateStructured.mockResolvedValueOnce(body)
    const config = { ...portfolioConfig, limits: { metaJudgeMaxOutputTokens: 4000 } }
    const ac = new AbortController()

    await synthesize({ targetId: 't', claims: ['c'] }, verdicts, '', config, { signal: ac.signal })

    const args = generateStructured.mock.calls[0][0]
    expect(args.maxOutputTokens).toBe(4000)
    expect(args.signal).toBe(ac.signal)
  })

  it('threads the absence note into the synthesis prompt', async () => {
    generateStructured.mockResolvedValueOnce(body)
    const note = '1 persona(s) failed to report and are absent from this panel: skeptical-peer.'

    await synthesize({ targetId: 't', claims: ['c'] }, verdicts, '', portfolioConfig, {}, note)

    const args = generateStructured.mock.calls[0][0]
    expect(args.prompt).toContain('## Panel note')
    expect(args.prompt).toContain(note)
  })
})
