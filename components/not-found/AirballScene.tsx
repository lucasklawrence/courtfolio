'use client'

import { usePathname } from 'next/navigation'
import { BackToCourtButton } from '@/components/common/BackToCourtButton'

/**
 * AirballScene renders the visual stage for the custom 404 page (issue #40).
 *
 * A basketball arcs from the low-left of the stage, peaks high above a hoop
 * on the right, and sails wide off-screen — the literal airball that gives
 * the page its punchline. The missed route is surfaced inline so visitors
 * immediately see what they were trying to load.
 *
 * Client component because it relies on `usePathname` to read the failed
 * URL. The 404 page metadata (title, description) is set by the parent
 * server component in `app/not-found.tsx`.
 */
export function AirballScene() {
  const pathname = usePathname()

  return (
    <div
      className="fixed inset-0 isolate overflow-hidden bg-neutral-950 text-white"
      style={{
        background:
          'radial-gradient(circle at 50% 55%, rgba(249,115,22,0.28) 0%, rgba(0,0,0,0) 55%), linear-gradient(to bottom, #000 0%, #171717 50%, #000 100%)',
      }}
    >
      <style>{`
        /* Horizontal travel: linear, constant velocity left → off-screen right. */
        @keyframes airball-x {
          0%   { transform: translateX(0); opacity: 0; }
          6%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateX(118vw); opacity: 0; }
        }
        /* Vertical travel: ease-out on the rise (decelerating against gravity),
           ease-in on the fall (accelerating with gravity). True parabola. */
        @keyframes airball-y {
          0%   { transform: translateY(0) rotate(0deg); animation-timing-function: ease-out; }
          50%  { transform: translateY(-52vh) rotate(540deg); animation-timing-function: ease-in; }
          100% { transform: translateY(60vh) rotate(1080deg); }
        }
        .airball-x { animation: airball-x 4.5s linear infinite; }
        .airball-y { animation: airball-y 4.5s linear infinite; }
        @keyframes airball-blink { 50% { opacity: 0.2; } }
        .airball-blink { animation: airball-blink 1.2s steps(2) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .airball-x, .airball-y {
            animation: none;
          }
          .airball-x { transform: translateX(95vw); opacity: 1; }
          .airball-y { transform: translateY(8vh) rotate(900deg); }
          .airball-blink { animation: none; }
        }
      `}</style>

      {/* Screen-reader heading — gives assistive tech the "this is a 404" semantic
          that the visual AIRBALL headline alone doesn't convey. */}
      <h1 className="sr-only">Page not found</h1>

      {/* faint floor line */}
      <div
        className="absolute left-0 right-0"
        style={{
          bottom: '14%',
          height: '1px',
          background:
            'linear-gradient(to right, transparent, rgba(255,255,255,0.10) 20%, rgba(255,255,255,0.10) 80%, transparent)',
        }}
        aria-hidden="true"
      />

      {/* scoreboard chip — decorative, hidden from assistive tech so it
          doesn't read out before the actual "page not found" message. */}
      <div
        className="absolute top-4 left-4 z-10 flex gap-3 rounded-md border border-white/10 bg-black/60 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.16em] text-neutral-300"
        aria-hidden="true"
      >
        <span>Q4</span>
        <span className="airball-blink text-orange-500">0:00</span>
        <span>HOME 0</span>
        <span>ROUTE 0</span>
      </div>

      {/* hoop on the right — smaller and tucked into the corner on mobile so it
          doesn't crowd the centered AIRBALL headline on narrow viewports. */}
      <svg
        className="absolute z-[2] right-[6%] top-[10%] h-[78px] w-[66px] sm:right-[32%] sm:top-[22%] sm:h-[130px] sm:w-[110px]"
        viewBox="0 0 110 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="98" y="0" width="6" height="130" fill="#404040" />
        <rect
          x="62"
          y="14"
          width="44"
          height="36"
          fill="#0a0a0a"
          stroke="#fff"
          strokeWidth="1.5"
        />
        <rect x="76" y="26" width="16" height="14" fill="none" stroke="#fff" strokeWidth="1.2" />
        <ellipse cx="62" cy="56" rx="22" ry="4" fill="none" stroke="#ea580c" strokeWidth="3" />
        <path
          d="M44 58 L48 78 L62 82 L76 78 L80 58"
          fill="none"
          stroke="#ddd"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      </svg>

      {/* arcing ball — outer wrapper drives X (linear), inner SVG drives Y + spin (parabolic) */}
      <div
        className="airball-x absolute z-[3]"
        style={{ left: '-6%', top: '60%', width: '32px', height: '32px' }}
        aria-hidden="true"
      >
        <svg
          className="airball-y block"
          style={{ width: '32px', height: '32px' }}
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="16" cy="16" r="14" fill="#ea580c" stroke="#0a0a0a" strokeWidth="1.5" />
          <path
            d="M2 16 H30 M16 2 V30 M5 6 Q16 16 27 6 M5 26 Q16 16 27 26"
            stroke="#0a0a0a"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
      </div>

      {/* centered headline + CTA */}
      <div className="absolute inset-0 z-[4] flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-3.5 font-mono text-[11px] uppercase tracking-[0.18em] text-orange-300">
          Missed Field Goal · 0 / 1 FG
        </div>
        <p
          className="m-0 mb-3.5 font-sans font-extrabold leading-[0.95] tracking-tight"
          style={{ fontSize: 'clamp(48px, 9vw, 112px)' }}
          aria-hidden="true"
        >
          AIRBALL.
        </p>
        <p className="mb-7 font-mono text-[13px] text-neutral-300">
          Couldn&apos;t find{' '}
          <code className="inline-block max-w-full break-all rounded bg-orange-500/10 px-2 py-0.5 text-[12px] text-orange-300">
            {pathname}
          </code>
        </p>
        <BackToCourtButton />
      </div>
    </div>
  )
}
