import { JSX } from 'react'

/**
 * Renders a centered SVG logo for "Lucas Lawrence" with circular ring text.
 *
 * - The name "LUCAS LAWRENCE" is centered in two lines.
 * - A circular path wraps descriptive phrases around the name using <textPath>.
 * - Designed to overlay cleanly on a basketball-themed SVG court.
 * - Uses Unicode non-breaking spaces to preserve spacing in JSX.
 *
 * Font: League Spartan (must be loaded separately via CSS or Google Fonts)
 *
 * @returns {JSX.Element} SVG element representing the personal logo.
 */
export function LogoSvg(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <path id="circlePath" d="M 250,250 m -200,0 a 200,200 0 1,1 400,0 a 200,200 0 1,1 -400,0" />
        <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#fff" floodOpacity="0.15" />
        </filter>
        <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#fff" floodOpacity="0.3" />
        </filter>
      </defs>
      <circle cx="250" cy="250" r="200" fill="#3e1f0e" opacity="0.85" />
      <text
        fontSize="13"
        fontFamily="'League Spartan', sans-serif"
        letterSpacing="2"
        fill="#f5f5f5"
        filter="url(#ringGlow)"
      >
        <textPath href="#circlePath" startOffset="50%" textAnchor="middle">
          {
            'HOOPER \u00A0• PATENT HOLDER \u00A0• CREATIVE ENGINEER \u00A0• HIP-HOP HEAD \u00A0• SYSTEMS THINKER \u00A0• CODE STORYTELLER \u00A0• FANTASY GM \u00A0• RHYTHM FOCUSED • HOOPER \u00A0• PATENT HOLDER \u00A0'
          }
        </textPath>
      </text>
      <text
        x="250"
        y="235"
        textAnchor="middle"
        fontSize="55"
        fontFamily="'League Spartan', sans-serif"
        fill="#fff"
        filter="url(#textShadow)"
      >
        LUCAS
      </text>
      <text
        x="250"
        y="295"
        textAnchor="middle"
        fontSize="55"
        fontFamily="'League Spartan', sans-serif"
        fill="#fff"
        filter="url(#textShadow)"
      >
        LAWRENCE
      </text>
    </svg>
  )
}
