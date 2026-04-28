import Link from 'next/link'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'

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
 */
export function TrainingFacilitySubareaShell({
  eyebrow,
  title,
  description,
  accentClassName,
  nextSteps,
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
