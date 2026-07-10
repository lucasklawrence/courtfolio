/**
 * The live panel's fixed inputs (#241): the owner-authored thesis, the baked
 * evidence, and the run config, keyed by target id.
 *
 * Mode A by design (#234): visitors can only *trigger* a run of these fixed,
 * server-side inputs — no visitor-authored text ever reaches a prompt, which
 * removes the prompt-injection surface a public thesis box would open.
 *
 * Evidence comes from the committed `npm run panel:bake` output (the Vercel
 * runtime has no repo filesystem; `repo-evidence.ts` must never be imported
 * here). The JSON is schema-validated at module load so a malformed re-bake
 * fails the build/boot loudly instead of feeding the panel garbage mid-run.
 */
import { z } from 'zod'

import { portfolioConfig } from '@/lib/panel/config'
import { DRAFT_ROOM_PERSONAS } from '@/lib/panel/personas'
import type { EvidenceContext, PanelConfig, Thesis } from '@/lib/panel/types'
import bakedCourtfolio from '@/lib/panel/evidence/baked/courtfolio.json'

import { PANEL_STAGE_LIMITS } from './limits'

/** Runtime schema for a baked {@link EvidenceContext} (see `panel:bake`). */
const evidenceContextSchema = z.object({
  targetId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  artifacts: z
    .array(
      z.object({
        path: z.string().min(1),
        excerpt: z.string(),
        note: z.string().optional(),
      })
    )
    .min(1),
})

/**
 * The fixed thesis the live panel pressure-tests — the same claims the stored
 * replay was judged on (`app/draft-room/panelResult.ts`), verbatim, so a live
 * run and the replay are directly comparable. A unit test enforces the
 * equality; edit both together or not at all.
 */
export const COURTFOLIO_THESIS: Thesis = {
  targetId: 'courtfolio',
  claims: [
    'Courtfolio is my portfolio reimagined as a playable basketball game — the whole site maps onto a court, with themed rooms visualizing my life and training through hand-built SVG and Framer Motion.',
    'It shows creativity and the ability to make something that stands out — a distinctive, memorable experience that does not look like anyone else’s portfolio — backed by the engineering to build it.',
    'I’m proud of the creativity and the engineering both, and that I built a genuinely fun place to show off my accomplishments and my life.',
  ],
}

/**
 * The run config for live panels: the validated portfolio set plus the #241
 * per-stage output-token ceilings — and the draft-room persona skin (#302):
 * live runs are judged by the GM / Film-Room Scout / Head Coach, the theme's
 * front office. The stored replay stays portfolio-voiced until a real run
 * replaces it (the #301 editorial step), so the two persona sets coexist
 * until then.
 */
export const livePanelConfig: PanelConfig = {
  ...portfolioConfig,
  personas: DRAFT_ROOM_PERSONAS,
  limits: PANEL_STAGE_LIMITS,
}

/** Everything the route needs to run one target's live panel. */
export interface LivePanelTarget {
  /** The fixed, owner-authored thesis. */
  thesis: Thesis
  /** The committed baked evidence the panel reasons over. */
  evidence: EvidenceContext
  /** Personas, axes, lineup, and stage limits for the run. */
  config: PanelConfig
}

/**
 * Registry of runnable live targets. Unknown ids are a 400 at the route — the
 * request body can only *select* from this map, never define inputs.
 */
export const LIVE_TARGETS: Record<string, LivePanelTarget> = {
  courtfolio: {
    thesis: COURTFOLIO_THESIS,
    evidence: evidenceContextSchema.parse(bakedCourtfolio),
    config: livePanelConfig,
  },
}

/**
 * Model id per persona id for a config — the run-start roster's model chips
 * (the visible proof the panel spans vendors).
 */
export function modelByPersonaId(config: PanelConfig): Record<string, string> {
  return Object.fromEntries(config.personas.map(p => [p.id, config.lineup.personas[p.family]]))
}

/** Lens line per persona id for a config — shown on skeleton cards. */
export function lensByPersonaId(config: PanelConfig): Record<string, string> {
  return Object.fromEntries(config.personas.map(p => [p.id, p.lens]))
}
