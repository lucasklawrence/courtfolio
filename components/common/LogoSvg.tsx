import { JSX } from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * Renders a centered SVG logo for "Lucas Lawrence" with circular ring text.
 *
 * - The name "LUCAS LAWRENCE" is centered in two lines.
 * - A circular path wraps descriptive phrases around the name using <textPath>.
 * - Designed to overlay cleanly on a basketball-themed SVG court.
 * - Uses non-breaking spaces to preserve spacing.
 *
 * Font: League Spartan (must be loaded separately via CSS or Google Fonts)
 *
 * @returns {JSX.Element} SVG element representing the personal logo.
 */
export function LogoSvg(): JSX.Element {
  return (
    <SvgUse
      href="/common/LogoSvg.svg#LogoSvg"
      viewBox="0 0 500 500"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    />
  )
}
