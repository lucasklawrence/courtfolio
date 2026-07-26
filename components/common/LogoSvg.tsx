import { JSX } from 'react'

/**
 * ID prefix for this logo's internal defs.
 *
 * The ring text, the drop shadows and the arc all reference each other by
 * document fragment, so the ids have to be unique within the page. They're
 * namespaced rather than generated (`useId`) so this stays renderable from a
 * Server Component — the court draws exactly one logo, so a fixed prefix is
 * sufficient.
 */
const ID = 'lucas-logo'

/** Phrases that circle the name. Trailing separator closes the loop visually. */
const RING_TEXT =
  'HOOPER • PATENT HOLDER • CREATIVE ENGINEER • HIP-HOP HEAD • ' +
  'SYSTEMS THINKER • CODE STORYTELLER • FANTASY GM • RHYTHM FOCUSED •'

/**
 * Centered "Lucas Lawrence" logo with circular ring text, drawn over centre
 * court.
 *
 * - "LUCAS LAWRENCE" sits on two centred lines.
 * - Descriptive phrases wrap around them on a circular `<textPath>`.
 *
 * **Inlined rather than referenced** from `/common/LogoSvg.svg` (#345
 * follow-up). It used to render as `<use href="/common/LogoSvg.svg#LogoSvg">`,
 * but a `<use>` pointing at an *external* file builds a shadow tree whose
 * internal fragment references — `textPath href="#circlePath"`, and both
 * `filter="url(…)"` — resolve against the *host* document, where those ids do
 * not exist. Browsers disagree wildly about this and iOS Safari drops them, so
 * the ring text vanished on mobile while the plain circle and the two straight
 * lines (which reference nothing) still drew. Inlining puts the defs in the
 * page that uses them, which is the only reliably portable arrangement.
 *
 * Font: League Spartan, loaded globally; falls back to the system sans.
 */
export function LogoSvg(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 500 500"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Lucas Lawrence"
    >
      <defs>
        <filter id={`${ID}-text-shadow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#fff" floodOpacity="0.15" />
        </filter>
        <filter id={`${ID}-ring-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#fff" floodOpacity="0.3" />
        </filter>
        {/* Circle drawn as two arcs so the text has a continuous path to follow. */}
        <path id={`${ID}-ring`} d="M50 250a200 200 0 1 1 400 0 200 200 0 1 1-400 0" />
      </defs>

      <circle cx="250" cy="250" r="200" fill="#3e1f0e" opacity="0.85" />

      <text
        fill="#f5f5f5"
        filter={`url(#${ID}-ring-glow)`}
        fontFamily="'League Spartan', sans-serif"
        fontSize="13"
        letterSpacing="2"
      >
        <textPath href={`#${ID}-ring`} startOffset="50%" textAnchor="middle">
          {RING_TEXT}
        </textPath>
      </text>

      <text
        x="250"
        y="235"
        fill="#fff"
        filter={`url(#${ID}-text-shadow)`}
        fontFamily="'League Spartan', sans-serif"
        fontSize="55"
        textAnchor="middle"
      >
        LUCAS
      </text>
      <text
        x="250"
        y="295"
        fill="#fff"
        filter={`url(#${ID}-text-shadow)`}
        fontFamily="'League Spartan', sans-serif"
        fontSize="55"
        textAnchor="middle"
      >
        LAWRENCE
      </text>
    </svg>
  )
}
