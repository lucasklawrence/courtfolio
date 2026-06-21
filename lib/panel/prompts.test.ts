import { describe, expect, it } from 'vitest'
import { buildPersonaPrompt, buildSynthesisPrompt, buildVerifyPrompt } from './prompts'
import { PORTFOLIO_AXES } from './config'
import type { EvidenceContext, Gap, PersonaVerdict, Thesis } from './types'

const thesis: Thesis = {
  targetId: 'courtfolio',
  claims: ['It is a basketball-themed portfolio.', 'It shows creativity.'],
}

const evidence: EvidenceContext = {
  targetId: 'courtfolio',
  title: 'Courtfolio',
  summary: 'A Next.js site mapped onto a basketball court.',
  artifacts: [
    { path: 'app/page.tsx', excerpt: 'export default function Home() {}', note: 'entry' },
  ],
}

describe('buildPersonaPrompt', () => {
  it('numbers claims 0-based so claimIndex lines up with the schema', () => {
    const prompt = buildPersonaPrompt(thesis, evidence, PORTFOLIO_AXES)
    expect(prompt).toContain('Claim [0]: It is a basketball-themed portfolio.')
    expect(prompt).toContain('Claim [1]: It shows creativity.')
  })

  it('embeds the evidence summary and every axis to score', () => {
    const prompt = buildPersonaPrompt(thesis, evidence, PORTFOLIO_AXES)
    expect(prompt).toContain('A Next.js site mapped onto a basketball court.')
    expect(prompt).toContain('app/page.tsx')
    for (const axis of PORTFOLIO_AXES) expect(prompt).toContain(axis.id)
  })

  it('instructs independence and grounding', () => {
    const prompt = buildPersonaPrompt(thesis, evidence, PORTFOLIO_AXES)
    expect(prompt).toMatch(/INDEPENDENT/)
    expect(prompt).toMatch(/GAP-FINDING/)
    expect(prompt.toLowerCase()).toContain('citation')
  })

  it('renders "(none)" when there are no artifacts', () => {
    const prompt = buildPersonaPrompt(thesis, { ...evidence, artifacts: [] }, PORTFOLIO_AXES)
    expect(prompt).toContain('(none)')
  })
})

describe('buildVerifyPrompt', () => {
  const gap: Gap = {
    claim: 'The morph does not exist.',
    artifactShows: 'No layoutId anywhere.',
    citation: 'components/project-binder',
    confidence: 0.7,
  }

  it('includes the gap fields and biases toward unverifiable over upheld', () => {
    const prompt = buildVerifyPrompt(gap, evidence)
    expect(prompt).toContain('The morph does not exist.')
    expect(prompt).toContain('components/project-binder')
    expect(prompt).toContain('unverifiable')
    expect(prompt).toMatch(/refuted.*contradict/)
  })
})

describe('buildSynthesisPrompt', () => {
  const verdict: PersonaVerdict = {
    personaId: 'hiring-manager',
    label: 'Skeptical Hiring Manager',
    scores: [{ axisId: 'portfolio-signal', score: 7, rationale: 'solid' }],
    gaps: [{ claim: 'c', artifactShows: 'a', citation: 'file.ts', confidence: 0.8 }],
    uncomfortableTruth: 'It buries its best signal.',
  }

  it('renders each verdict and tells the judge to surface disagreement', () => {
    const prompt = buildSynthesisPrompt(thesis, [verdict], '- (peer) "x" — refuted: wrong')
    expect(prompt).toContain('Skeptical Hiring Manager')
    expect(prompt).toContain('It buries its best signal.')
    expect(prompt).toContain('refuted')
    expect(prompt.toLowerCase()).toContain('disagreement')
  })

  it('shows "(none)" when nothing was refuted', () => {
    const prompt = buildSynthesisPrompt(thesis, [verdict], '')
    expect(prompt).toContain('(none)')
  })
})
