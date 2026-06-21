import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PersonaVerdict, VerifiedGap } from './types'

const generateStructured = vi.fn()
vi.mock('./models', async importOriginal => ({
  ...(await importOriginal<typeof import('./models')>()),
  generateStructured: (args: unknown) => generateStructured(args),
}))

const { verifyGaps, stripRefutedGaps, caughtErrors, refutedNote } = await import('./verify')
const { portfolioConfig } = await import('./config')
const { textEvidence } = await import('./evidence/text-evidence')

const verdicts: PersonaVerdict[] = [
  {
    personaId: 'hiring-manager',
    label: 'HM',
    scores: [],
    uncomfortableTruth: 't',
    gaps: [
      { claim: 'real gap', artifactShows: 'x', citation: 'a.ts', confidence: 0.9 },
      { claim: 'bogus gap', artifactShows: 'morph missing', citation: 'b.ts', confidence: 0.6 },
    ],
  },
]

const verified: VerifiedGap[] = [
  {
    claim: 'real gap',
    artifactShows: 'x',
    citation: 'a.ts',
    confidence: 0.9,
    personaId: 'hiring-manager',
    verdict: 'upheld',
    verifyNote: 'backed',
  },
  {
    claim: 'bogus gap',
    artifactShows: 'morph missing',
    citation: 'b.ts',
    confidence: 0.6,
    personaId: 'hiring-manager',
    verdict: 'refuted',
    verifyNote: 'morph exists in cardMorph.ts',
  },
]

describe('stripRefutedGaps', () => {
  it('removes only the refuted gap, matched by persona+citation', () => {
    const out = stripRefutedGaps(verdicts, verified)
    expect(out[0].gaps.map(g => g.citation)).toEqual(['a.ts'])
  })

  it('does not mutate the input verdicts', () => {
    stripRefutedGaps(verdicts, verified)
    expect(verdicts[0].gaps).toHaveLength(2)
  })
})

describe('caughtErrors / refutedNote', () => {
  it('surfaces refuted gaps as caught errors', () => {
    expect(caughtErrors(verified)).toEqual([
      {
        personaId: 'hiring-manager',
        claim: 'bogus gap',
        verifyNote: 'morph exists in cardMorph.ts',
      },
    ])
  })

  it('renders a refuted note for the synthesis prompt, empty when none refuted', () => {
    expect(refutedNote(verified)).toContain('bogus gap')
    expect(refutedNote([verified[0]])).toBe('')
  })
})

describe('verifyGaps', () => {
  beforeEach(() => generateStructured.mockReset())

  it('verifies every gap on the verifier model and tags each ruling', async () => {
    generateStructured
      .mockResolvedValueOnce({ verdict: 'upheld', verifyNote: 'backed' })
      .mockResolvedValueOnce({ verdict: 'refuted', verifyNote: 'wrong' })

    const out = await verifyGaps(verdicts, textEvidence('t', 'T', 's'), portfolioConfig)

    expect(out).toHaveLength(2)
    expect(out.map(g => g.verdict)).toEqual(['upheld', 'refuted'])
    expect(out.every(g => g.personaId === 'hiring-manager')).toBe(true)
    expect(
      generateStructured.mock.calls.every(c => c[0].model === portfolioConfig.lineup.verifier)
    ).toBe(true)
  })
})
