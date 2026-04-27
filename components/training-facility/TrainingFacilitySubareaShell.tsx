import Link from 'next/link'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'

/**
 * Optional call-to-action rendered below the placeholder copy. Used while the
 * sub-area is still a placeholder but already has at least one real interior
 * route worth navigating to (e.g. the Stair Climber detail view).
 */
export type TrainingFacilitySubareaCta = {
  /** Internal Next.js path the CTA links to. */
  href: string
  /** Visible button text. */
  label: string
  /** Sub-line shown under the CTA button — short context for the destination. */
  helper?: string
}

/**
 * Props for the placeholder Training Facility sub-area shell used by Gym and Combine.
 */
type TrainingFacilitySubareaShellProps = {
  /**
   * Small contextual label shown above the main title.
   */
  eyebrow: string

  /**
   * Main page title for the sub-area.
   */
  title: string

  /**
   * Short explanation of what the finished space will hold.
   */
  description: string

  /**
   * Accent color used to differentiate the room.
   */
  accentClassName: string

  /**
   * Concrete next-phase items that make the placeholder route useful today.
   */
  nextSteps: string[]

  /**
   * Optional CTA rendered after the description. Bridge while a sub-area still
   * uses the placeholder shell but already has at least one real interior
   * route worth surfacing — e.g. the Gym placeholder linking to the Stair
   * Climber detail view before the Gym scene SVG lands. Goes away once the
   * scene replaces this shell entirely.
   */
  cta?: TrainingFacilitySubareaCta
}

/**
 * Shared shell for the early Gym and Combine routes.
 *
 * The route exists now so the Training Facility navigation is real, but the
 * interactive detail builds can land in later issues without breaking the shell.
 *
 * @param props.eyebrow - Small contextual label shown above the room title.
 * @param props.title - Main sub-area title rendered as the page heading.
 * @param props.description - Short explanation of what the finished sub-area will contain.
 * @param props.accentClassName - Tailwind class string used for the room's accent bar.
 * @param props.nextSteps - Ordered list of follow-up implementation items for the sub-area.
 * @param props.cta - Optional CTA rendered after the description. Used to surface a real interior
 *   route (e.g. the Stair Climber detail view) while the placeholder shell is still in place.
 */
export function TrainingFacilitySubareaShell({
  eyebrow,
  title,
  description,
  accentClassName,
  nextSteps,
  cta,
}: TrainingFacilitySubareaShellProps) {
  return (
    <div className="relative min-h-svh overflow-hidden bg-[#120d0a] text-[#f7ead9]">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_28%),linear-gradient(180deg,#241811_0%,#120d0a_52%,#0b0806_100%)]"
      />

      <div className="relative z-10 mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 py-8 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BackToCourtButton />
          <Link
            href="/training-facility"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
          >
            Back to Training Facility
          </Link>
        </div>

        <div className="mt-16 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-[0_28px_70px_rgba(0,0,0,0.34)] backdrop-blur-sm">
          <div className={`h-2 w-full ${accentClassName}`} />
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="text-xs font-semibold uppercase tracking-[0.38em] text-white/60">
              {eyebrow}
            </div>
            <h1 className="mt-4 text-4xl font-black uppercase tracking-[0.08em] text-[#fff7ec] sm:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-[#e8d5be] sm:text-lg">
              {description}
            </p>

            {cta && (
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  href={cta.href}
                  className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.28em] text-[#1a0d05] shadow-[0_12px_30px_rgba(234,88,12,0.45)] transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#120d0a]"
                >
                  {cta.label}
                  <span aria-hidden="true">→</span>
                </Link>
                {cta.helper && (
                  <p className="max-w-md text-xs leading-5 text-white/55">{cta.helper}</p>
                )}
              </div>
            )}

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
              <div className="rounded-[1.6rem] border border-white/10 bg-black/25 p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.32em] text-white/55">
                  Why this route exists now
                </div>
                <p className="mt-4 text-sm leading-7 text-white/75">
                  Issue #60 wires the Training Facility structure end to end. That
                  means the top-level shell, the home-court entrance, and these two
                  destination routes are all real before the richer room art and data
                  views land in later phases.
                </p>
              </div>

              <div className="rounded-[1.6rem] border border-white/10 bg-black/25 p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.32em] text-white/55">
                  Next up
                </div>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-white/75">
                  {nextSteps.map(step => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
