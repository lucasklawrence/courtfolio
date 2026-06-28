/**
 * Stored panel result for the Draft Room showcase (#234 Phase 2 / #241).
 *
 * The public page is a **pre-baked showcase**: the panel is run once, offline,
 * and its result is replayed here with an animated reveal — so visiting the page
 * costs nothing and exposes no public paid endpoint (the cost/abuse model chosen
 * for v1). A real cross-family run (`npm run panel`) drops in by replacing this
 * object; until then it is **illustrative**, authored from the real terminal
 * verdict, and badged as such on the page (the same honesty convention the
 * Weight Room uses for its demo data).
 *
 * Typed as {@link PanelResult} so it is checked against the engine contract.
 */
import type { PanelResult } from '@/lib/panel/types'

/**
 * Whether {@link courtfolioPanelResult} is hand-authored illustrative data
 * rather than the output of a live model run. Drives the on-page badge. Set to
 * `false` once a real baked run replaces the object below.
 */
export const PANEL_RESULT_IS_ILLUSTRATIVE = true

/** The thesis the stored panel judged (Courtfolio's revised "creativity" thesis). */
export const courtfolioPanelResult: PanelResult = {
  thesis: {
    targetId: 'courtfolio',
    claims: [
      'Courtfolio is my portfolio reimagined as a playable basketball game — the whole site maps onto a court, with themed rooms visualizing my life and training through hand-built SVG and Framer Motion.',
      'It shows creativity and the ability to make something that stands out — a distinctive, memorable experience that does not look like anyone else’s portfolio — backed by the engineering to build it.',
      'I’m proud of the creativity and the engineering both, and that I built a genuinely fun place to show off my accomplishments and my life.',
    ],
  },
  verdicts: [
    {
      personaId: 'hiring-manager',
      label: 'Skeptical Hiring Manager',
      scores: [
        {
          axisId: 'learning-value',
          score: 6,
          rationale: 'Real engineering exists but is unevenly distributed and buried under theme.',
        },
        {
          axisId: 'portfolio-signal',
          score: 7,
          rationale:
            'The craft that would earn an interview is real, but not what greets me in the first 30 seconds.',
        },
      ],
      gaps: [
        {
          claimIndex: 1,
          claim: '"Distinctive / stands out" should get scrutiny, not a pass.',
          artifactShows:
            'Basketball theme + emoji-labeled zone buttons + a 20s auto-intro is squarely in the crowded gimmick-portfolio genre; the genuinely distinctive parts are gated behind clicks.',
          citation: 'components/court/TunnelHero.tsx, ZoneProjectsModern.tsx',
          confidence: 0.7,
        },
        {
          claimIndex: 0,
          claim: '"Playable basketball game" oversells the court entry.',
          artifactShows:
            'The top-level "game" is a themed nav menu; the genuinely game-like layer is a separate free-roam mode most 30-second visitors never trigger.',
          citation: 'components/court/FreeRoamPlayer.tsx',
          confidence: 0.66,
        },
      ],
      uncomfortableTruth:
        'The basketball theme does more to hide your best engineering than to showcase it — a skeptic reads "another gimmick portfolio" and bounces before reaching the parts that would earn the interview.',
      standoutObservation:
        'Borderline-advance: the buried craft is real senior signal, but it depends entirely on whether I click past the front door.',
    },
    {
      personaId: 'staff-mentor',
      label: 'Staff-Engineer Mentor',
      scores: [
        {
          axisId: 'learning-value',
          score: 7,
          rationale:
            'The hand-traced court, illustrated rooms, and a chalk data-viz language stretched real craft.',
        },
        {
          axisId: 'portfolio-signal',
          score: 7,
          rationale:
            'Reads as a real concept executed with taste, but the depth is concentrated in a few files.',
        },
      ],
      gaps: [
        {
          claimIndex: 1,
          claim: 'The concept thins from "built scene" to "skin" as you go deeper.',
          artifactShows:
            'The locker room and facility scenes are genuinely built, but several rooms are standard chart-card dashboards whose only theme-tether is a handwriting font and a rough.js stroke.',
          citation: 'components/training-facility/**, app/projects/page.tsx',
          confidence: 0.7,
        },
        {
          claimIndex: 2,
          claim: 'Breadth-of-polish substitutes for depth in the rooms.',
          artifactShows:
            'Many small, correct, well-named modules — discipline, but wide-and-shallow: no single algorithmically hard problem distinguishes staff-level depth.',
          citation: 'lib/training-facility/training-load.ts',
          confidence: 0.6,
        },
      ],
      uncomfortableTruth:
        'Your strongest work proves you can go deep, which makes the rest of the repo’s deliberate shallowness read as a choice — you’re demonstrating taste and discipline more than hard engineering.',
      standoutObservation:
        'What to build next: make one room’s data layer genuinely hard (own the ingestion end), so depth is pervasive, not concentrated.',
    },
    {
      personaId: 'skeptical-peer',
      label: 'Skeptical Peer',
      scores: [
        {
          axisId: 'learning-value',
          score: 7,
          rationale:
            'The RAF game-loop sprite and the Supabase/RLS/telemetry plumbing are genuinely transferable craft.',
        },
        {
          axisId: 'portfolio-signal',
          score: 8,
          rationale:
            'Distinctive concept, mostly delivered — but the strongest evidence is hidden behind a flag.',
        },
      ],
      gaps: [
        {
          claimIndex: 0,
          claim: '"Plays like a game" oversells a decorative sprite.',
          artifactShows:
            'FreeRoamPlayer is a real game loop but is pointer-events-none with no collision or zone-entry logic — walking the player navigates nothing; the site is driven by ordinary buttons.',
          citation: 'components/court/FreeRoamPlayer.tsx',
          confidence: 0.9,
        },
        {
          claimIndex: 1,
          claim: 'The most finished, most impressive feature ships OFF.',
          artifactShows:
            'The entire Training Facility (real Supabase logs, ~81 test files, e2e, telemetry) is gated by a feature flag defaulting false — a fresh clone sees the least of the engineering.',
          citation: 'lib/feature-flags.ts',
          confidence: 0.85,
        },
        {
          claimIndex: 2,
          claim: 'The signature artifact ships production debt.',
          artifactShows:
            'CourtSvg.tsx wires 114 dead console.log("Clicked zone N") handlers onto the court geometry — debug scaffolding left in the frame of the thing the concept is named after.',
          citation: 'components/court/CourtSvg.tsx',
          confidence: 0.8,
        },
      ],
      uncomfortableTruth:
        'The polished, custom-built UI you’re proudest of is the least-tested part of the codebase — the rigor lives in backend plumbing a visitor never sees.',
      standoutObservation:
        'The tell toward real, not theater: the telemetry PII guard emits only the error class and route pattern — a habit from having been burned in production.',
    },
  ],
  verifiedGaps: [
    // Upheld gaps are summarized in the verdicts above; the entries below are the
    // ones the verifier ruled on notably — including the two it refuted.
    {
      claim: 'The shared-element morph does not exist; layoutId returns nothing.',
      artifactShows: 'Asserted there is no morph component anywhere.',
      citation: 'components/project-binder',
      confidence: 0.6,
      personaId: 'staff-mentor',
      gapIndex: 2,
      verdict: 'refuted',
      verifyNote:
        'Contradicted by the evidence: the morph is real (components/project-binder/cardMorph.ts, covered by e2e/project-detail.spec.ts).',
    },
    {
      claim: 'The "Won 2024 league" impact line is fake.',
      artifactShows: 'Inferred "fake" from the project’s coming-soon status.',
      citation: 'components/project-binder/ProjectGallery.tsx',
      confidence: 0.5,
      personaId: 'skeptical-peer',
      gapIndex: 3,
      verdict: 'refuted',
      verifyNote:
        'A real accomplishment, not a fabricated line — the coming-soon status does not make the achievement false.',
    },
  ],
  synthesis: {
    targetId: 'courtfolio',
    scoreboard: [
      {
        personaId: 'hiring-manager',
        label: 'Skeptical Hiring Manager',
        scores: [
          { axisId: 'learning-value', score: 6, rationale: 'Real but buried.' },
          {
            axisId: 'portfolio-signal',
            score: 7,
            rationale: 'Earns an interview only if you dig in.',
          },
        ],
      },
      {
        personaId: 'staff-mentor',
        label: 'Staff-Engineer Mentor',
        scores: [
          { axisId: 'learning-value', score: 7, rationale: 'Real craft, concentrated depth.' },
          {
            axisId: 'portfolio-signal',
            score: 7,
            rationale: 'Tasteful concept; depth in a few files.',
          },
        ],
      },
      {
        personaId: 'skeptical-peer',
        label: 'Skeptical Peer',
        scores: [
          { axisId: 'learning-value', score: 7, rationale: 'Transferable plumbing craft.' },
          {
            axisId: 'portfolio-signal',
            score: 8,
            rationale: 'Delivered, but best evidence is hidden.',
          },
        ],
      },
    ],
    convergence: [
      {
        finding:
          '"Plays like a game" oversells a decorative sprite — the free-roam player navigates nothing; the site runs on ordinary buttons.',
        personaIds: ['hiring-manager', 'skeptical-peer'],
        citations: ['components/court/FreeRoamPlayer.tsx'],
      },
      {
        finding:
          'The best, most distinctive work is hidden — behind a feature flag, behind clicks, behind a 20s intro — so the part that stands out and the part with substance barely overlap on first view.',
        personaIds: ['hiring-manager', 'staff-mentor', 'skeptical-peer'],
        citations: ['lib/feature-flags.ts', 'components/court/TunnelHero.tsx'],
      },
    ],
    disagreements: [
      {
        topic: 'Does the basketball theme help or hurt the portfolio signal?',
        positions: [
          {
            personaId: 'hiring-manager',
            stance:
              'Hurts on a 30-second skim — files under "cute personal site" before the craft is seen.',
          },
          {
            personaId: 'staff-mentor',
            stance: 'Helps — a real concept executed with taste, once you read the code.',
          },
          {
            personaId: 'skeptical-peer',
            stance:
              'Distinctive but front-loaded — the standout parts and the substantive parts barely overlap.',
          },
        ],
        honestSignal:
          'The split maps to lens: the theme pays off only for someone who already decided to dig in, and costs you with the skim-readers who decide first. Your audience is mostly skim-readers.',
      },
    ],
    robustFindings: [
      'Across two different theses (engineering discipline, then creativity), the panel kept landing on the same structural problem: Courtfolio buries its best signal behind its front door.',
      'The genuinely distinctive moment — the Combine’s SprintRace, where logged sprint times become racing lanes whose animation duration equals the real run time — is the thing to build more of; most rooms are dashboards wearing a handwriting font.',
    ],
    topMoves: [
      'Lead with the SprintRace or a real room instead of the 20s intro.',
      'Either make the sprite do something (collision → navigation) or stop calling it a "game".',
      'Delete the 114 debug console.log handlers in CourtSvg.tsx.',
      'Decide what’s on the public surface — un-hide the Training Facility.',
    ],
    caughtErrors: [
      {
        personaId: 'staff-mentor',
        claim: 'The shared-element morph does not exist; layoutId returns nothing.',
        verifyNote:
          'Refuted — the morph is real (cardMorph.ts, covered by e2e/project-detail.spec.ts).',
      },
      {
        personaId: 'skeptical-peer',
        claim: 'The "Won 2024 league" impact line is fake.',
        verifyNote:
          'Refuted — a real accomplishment; the coming-soon status does not make it false.',
      },
    ],
    verdict:
      'A real, distinctive concept executed with taste — and a genuine engineering spine the front door hides. The creativity claim holds for a design-literate viewer; for the people screening eng roles in 30 seconds it reads gimmick-first. Lead with your strongest, most novel moment, make the "game" do something, and the same craft that’s currently buried becomes the signal.',
  },
}
