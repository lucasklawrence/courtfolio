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
    gapIndex: 0,
    verdict: 'upheld',
    verifyNote: 'backed',
  },
  {
    claim: 'bogus gap',
    artifactShows: 'morph missing',
    citation: 'b.ts',
    confidence: 0.6,
    personaId: 'hiring-manager',
    gapIndex: 1,
    verdict: 'refuted',
    verifyNote: 'morph exists in cardMorph.ts',
  },
]

describe('stripRefutedGaps', () => {
  it('removes only the refuted gap, matched by persona+gapIndex', () => {
    const out = stripRefutedGaps(verdicts, verified)
    expect(out[0].gaps.map(g => g.citation)).toEqual(['a.ts'])
  })

  it('does not strip a sibling gap that cites the same file as a refuted one', () => {
    // Both gaps cite the same file; only index 0 is refuted. Index-based keying
    // must keep index 1 (the regression both review bots flagged).
    const sameCite = [
      {
        personaId: 'p',
        label: 'P',
        scores: [],
        uncomfortableTruth: 't',
        gaps: [
          { claim: 'wrong', artifactShows: 'a', citation: 'cardMorph.ts', confidence: 0.5 },
          { claim: 'right', artifactShows: 'b', citation: 'cardMorph.ts', confidence: 0.9 },
        ],
      },
    ]
    const rulings: VerifiedGap[] = [
      { ...sameCite[0].gaps[0], personaId: 'p', gapIndex: 0, verdict: 'refuted', verifyNote: 'no' },
      { ...sameCite[0].gaps[1], personaId: 'p', gapIndex: 1, verdict: 'upheld', verifyNote: 'yes' },
    ]
    const out = stripRefutedGaps(sameCite, rulings)
    expect(out[0].gaps.map(g => g.claim)).toEqual(['right'])
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
    expect(out.map(g => g.gapIndex)).toEqual([0, 1])
    expect(out.every(g => g.personaId === 'hiring-manager')).toBe(true)
    expect(
      generateStructured.mock.calls.every(c => c[0].model === portfolioConfig.lineup.verifier)
    ).toBe(true)
  })
})
