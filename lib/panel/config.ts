/**
 * Panel configurations — one per application "skin". A config bundles the
 * personas, scoring axes, and model lineup; swapping it (plus the evidence
 * adapter) is what turns the portfolio judge into the decision pressure-tester
 * or the growth coach (#235) with no engine change.
 */
import { DEFAULT_LINEUP } from './models'
import { PORTFOLIO_PERSONAS } from './personas'
import type { Axis, PanelConfig } from './types'

/**
 * The two portfolio axes. Scoring on both *separately* is the whole point —
 * conflating "did it teach me" with "does it convince a skeptic" is the most
 * common self-assessment error (#234).
 */
export const PORTFOLIO_AXES: Axis[] = [
  {
    id: 'learning-value',
    label: 'Learning value',
    description:
      'Did building this genuinely stretch the author? High = real new skill/depth; low = repetition of what they already knew.',
  },
  {
    id: 'portfolio-signal',
    label: 'Portfolio signal',
    description:
      'Does the artifact convince a skeptical reviewer the author is strong? High = clear evidence of the claimed skill; low = the claim outruns what is shown.',
  },
]

/**
 * Default configuration: the validated generic personas, the two portfolio axes,
 * and the default cross-family model lineup.
 */
export const portfolioConfig: PanelConfig = {
  name: 'portfolio',
  personas: PORTFOLIO_PERSONAS,
  axes: PORTFOLIO_AXES,
  lineup: DEFAULT_LINEUP,
}

/**
 * Validate a config before a run. Cheap guards that catch the mistakes that
 * would otherwise surface as confusing mid-run model errors.
 *
 * @throws if the config has no personas, no axes, fewer than two model families
 *   among personas, or a missing/blank model id for any role (a persona family,
 *   the meta-judge, or the verifier).
 */
export function assertValidConfig(config: PanelConfig): void {
  if (config.personas.length === 0) throw new Error('PanelConfig has no personas.')
  if (config.axes.length === 0) throw new Error('PanelConfig has no axes.')

  const families = new Set(config.personas.map(p => p.family))
  if (families.size < 2) {
    throw new Error(
      `PanelConfig "${config.name}" spans only one model family (${[...families].join(', ')}); cross-family diversity needs ≥2.`
    )
  }
  const blank = (id: string | undefined) => !id || id.trim().length === 0
  for (const family of families) {
    if (blank(config.lineup.personas[family])) {
      throw new Error(
        `PanelConfig "${config.name}" has personas in family "${family}" but no model for it in the lineup.`
      )
    }
  }
  if (blank(config.lineup.metaJudge))
    throw new Error(`PanelConfig "${config.name}" has no metaJudge model id.`)
  if (blank(config.lineup.verifier))
    throw new Error(`PanelConfig "${config.name}" has no verifier model id.`)
}
