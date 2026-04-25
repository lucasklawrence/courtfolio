/**
 * Court Vision chart palette — PRD §8.
 *
 * Aligns with existing tokens in `.claude/skills/court-vision-design/colors_and_type.css`:
 * `paper-cream`, `orange-primary`, `court-ink`. Hardwood tan is lighter than the
 * site's `hardwood-warm` token because basketball-floor maple reads as honey, not
 * walnut — the chart needs the lighter shade so ink-on-tan stays readable.
 */
export const chartPalette = {
  hardwoodTan: '#C9A268',
  courtLineCream: '#F5F1E6',
  rimOrange: '#EA580C',
  inkBlack: '#0A0A0A',
  inkSoft: '#404040',
} as const

export type ChartPalette = typeof chartPalette
