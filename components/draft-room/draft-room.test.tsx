import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PersonaVerdictCard } from './PersonaVerdictCard'
import { AgreementMap } from './AgreementMap'
import { SynthesisPanel } from './SynthesisPanel'
import type { MetaSynthesis, PersonaVerdict } from '@/lib/panel/types'

const verdict: PersonaVerdict = {
  personaId: 'skeptical-peer',
  label: 'Skeptical Peer',
  scores: [
    { axisId: 'learning-value', score: 7, rationale: 'transferable craft' },
    { axisId: 'portfolio-signal', score: 8, rationale: 'mostly delivered' },
  ],
  gaps: [
    {
      claim: 'plays like a game oversells a sprite',
      artifactShows: 'pointer-events-none, no collision',
      citation: 'components/court/FreeRoamPlayer.tsx',
      confidence: 0.9,
    },
  ],
  uncomfortableTruth: 'the UI you are proudest of is the least tested',
  standoutObservation: 'the PII guard is a real production habit',
}

describe('PersonaVerdictCard', () => {
  it('renders the persona, both axis scores, the gap with its citation, and the truth', () => {
    render(<PersonaVerdictCard verdict={verdict} />)
    expect(screen.getByRole('heading', { name: 'Skeptical Peer' })).toBeInTheDocument()
    expect(screen.getByText('Learning value')).toBeInTheDocument()
    expect(screen.getByText('Portfolio signal')).toBeInTheDocument()
    expect(screen.getByText('7/10')).toBeInTheDocument()
    expect(screen.getByText(/plays like a game oversells a sprite/)).toBeInTheDocument()
    expect(screen.getByText('components/court/FreeRoamPlayer.tsx')).toBeInTheDocument()
    expect(screen.getByText(/least tested/)).toBeInTheDocument()
  })

  it('omits the standout line when none is present', () => {
    const { standoutObservation: _standoutObservation, ...rest } = verdict
    render(<PersonaVerdictCard verdict={rest} />)
    expect(screen.queryByText(/Standout/)).not.toBeInTheDocument()
  })
})

const synthesis: MetaSynthesis = {
  targetId: 'courtfolio',
  scoreboard: [{ personaId: 'skeptical-peer', label: 'Skeptical Peer', scores: verdict.scores }],
  convergence: [
    {
      finding: 'best work is hidden',
      personaIds: ['hiring-manager', 'skeptical-peer'],
      citations: ['lib/feature-flags.ts'],
    },
  ],
  disagreements: [
    {
      topic: 'Does the theme help or hurt?',
      positions: [
        { personaId: 'hiring-manager', stance: 'hurts on a skim' },
        { personaId: 'skeptical-peer', stance: 'distinctive but front-loaded' },
      ],
      honestSignal: 'pays off only for those who dig in',
    },
  ],
  robustFindings: ['buries its best signal'],
  topMoves: ['lead with the sprint race', 'delete the debug logs'],
  caughtErrors: [
    {
      personaId: 'staff-mentor',
      claim: 'the morph does not exist',
      verifyNote: 'refuted — it is real',
    },
  ],
  verdict: 'a real distinctive concept the front door hides',
}

const labelById = { 'hiring-manager': 'Hiring Manager', 'skeptical-peer': 'Skeptical Peer' }

describe('AgreementMap', () => {
  it('shows convergence with persona chips and the disagreement honest signal', () => {
    render(
      <AgreementMap
        convergence={synthesis.convergence}
        disagreements={synthesis.disagreements}
        labelById={labelById}
      />
    )
    expect(screen.getByText('best work is hidden')).toBeInTheDocument()
    expect(screen.getByText('Does the theme help or hurt?')).toBeInTheDocument()
    expect(screen.getByText(/pays off only for those who dig in/)).toBeInTheDocument()
    // persona ids are rendered as human labels, not raw ids
    expect(screen.queryByText('skeptical-peer')).not.toBeInTheDocument()
  })
})

describe('SynthesisPanel', () => {
  it('renders robust findings, ordered moves, overruled claims, and the verdict', () => {
    render(<SynthesisPanel synthesis={synthesis} />)
    expect(screen.getByText('buries its best signal')).toBeInTheDocument()
    expect(screen.getByText('lead with the sprint race')).toBeInTheDocument()
    const caught = screen.getByText(/Overruled scouting claims/).closest('section')
    expect(caught).not.toBeNull()
    expect(within(caught as HTMLElement).getByText(/the morph does not exist/)).toBeInTheDocument()
    expect(screen.getByText(/the front door hides/)).toBeInTheDocument()
  })

  it('hides the overruled-claims section when nothing was refuted', () => {
    render(<SynthesisPanel synthesis={{ ...synthesis, caughtErrors: [] }} />)
    expect(screen.queryByText(/Overruled scouting claims/)).not.toBeInTheDocument()
  })
})
