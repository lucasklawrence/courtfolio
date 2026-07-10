/**
 * Display labels for the portfolio scoring axes, kept local to the Draft Room.
 *
 * Deliberately NOT imported from `@/lib/panel/config`: that module pulls in the
 * AI SDK via the model lineup, which would bundle the gateway client into this
 * client-rendered showcase. The labels are just presentation, so they live here.
 */
export const AXIS_LABEL: Record<string, string> = {
  'learning-value': 'Learning value',
  'portfolio-signal': 'Portfolio signal',
}

/** Human label for an axis id, falling back to the id itself if unknown. */
export function axisLabel(axisId: string): string {
  return AXIS_LABEL[axisId] ?? axisId
}

/**
 * Display name for a target id on the report's PROSPECT line (`courtfolio` →
 * `Courtfolio`). Presentation only — ids stay slugs everywhere else.
 */
export function prospectLabel(targetId: string): string {
  return targetId.charAt(0).toUpperCase() + targetId.slice(1)
}
