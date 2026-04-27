import Link from 'next/link'

/**
 * Supported color treatments for Training Facility door cards.
 */
type TrainingFacilityDoorTone = 'amber' | 'sky' | 'slate'

/**
 * Props for a navigable or disabled Training Facility door.
 */
type TrainingFacilityDoorProps = {
  /**
   * Small overline shown above the main label.
   */
  eyebrow: string

  /**
   * Main destination name rendered on the door placard.
   */
  title: string

  /**
   * Route target when the door is active.
   */
  href?: string

  /**
   * Supporting copy describing the destination.
   */
  description: string

  /**
   * Short phrase rendered inside the doorway window to hint at the contents.
   */
  doorwayHint: string

  /**
   * Footer copy used as a route label or roadmap note.
   */
  footer: string

  /**
   * Visual color treatment used to distinguish destinations.
   */
  tone: TrainingFacilityDoorTone

  /**
   * When true, the door is presented as a visible roadmap item but does not navigate.
   */
  disabled?: boolean
}

/**
 * Tailwind class groups keyed by `TrainingFacilityDoorTone`.
 *
 * Each tone entry defines the frame, placard, doorway glow, and text classes
 * used to style a Training Facility door card consistently across variants.
 */
const toneClasses: Record<
  TrainingFacilityDoorTone,
  {
    frame: string
    placard: string
    glow: string
    text: string
  }
> = {
  amber: {
    frame: 'border-amber-200/45 bg-[#2e1c13]/90',
    placard: 'border-amber-200/30 bg-amber-100/10',
    glow: 'from-[#66401d] via-[#24130c] to-[#120905]',
    text: 'text-amber-50',
  },
  sky: {
    frame: 'border-sky-200/40 bg-[#182333]/90',
    placard: 'border-sky-200/25 bg-sky-100/10',
    glow: 'from-[#274968] via-[#112031] to-[#09121c]',
    text: 'text-sky-50',
  },
  slate: {
    frame: 'border-stone-200/25 bg-[#26211d]/85',
    placard: 'border-stone-200/20 bg-stone-100/5',
    glow: 'from-[#504741] via-[#1d1815] to-[#0e0a09]',
    text: 'text-stone-100',
  },
}

/**
 * Door card used by the Training Facility shell to represent sub-area entry points.
 *
 * @param props.eyebrow - Small overline used to categorize the destination.
 * @param props.title - Main destination label shown on the door placard.
 * @param props.href - Optional route target; omitted only when rendering a non-link fallback.
 * @param props.description - Supporting copy explaining what the destination contains.
 * @param props.doorwayHint - Short phrase rendered in the doorway window to hint at the contents.
 * @param props.footer - Footer copy used as a route status or roadmap note.
 * @param props.tone - Visual tone key used to look up the door styling classes.
 * @param props.disabled - When true, disables navigation and renders the door as an inert roadmap placeholder.
 */
export function TrainingFacilityDoor({
  eyebrow,
  title,
  href,
  description,
  doorwayHint,
  footer,
  tone,
  disabled = false,
}: TrainingFacilityDoorProps) {
  const colors = toneClasses[tone]
  const baseClassName = [
    'group flex h-full min-h-[21rem] flex-col rounded-[2rem] border p-5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.28)] transition duration-200',
    colors.frame,
    colors.text,
    disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.34)]',
  ].join(' ')

  const content = (
    <>
      <div className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${colors.placard}`}>
        {eyebrow}
      </div>

      <div className="mt-4">
        <h2 className="text-3xl font-black uppercase tracking-[0.08em] sm:text-[2.1rem]">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-current/80">{description}</p>
      </div>

      <div className={`mt-6 flex flex-1 items-end rounded-[999px_999px_1rem_1rem] border border-white/10 bg-gradient-to-b p-4 ${colors.glow}`}>
        <div className="flex h-full w-full items-end justify-center rounded-[999px_999px_0.8rem_0.8rem] border border-dashed border-white/15 bg-black/35 px-4 py-5 text-center text-sm font-semibold uppercase tracking-[0.24em] text-white/85 shadow-inner">
          {doorwayHint}
        </div>
      </div>

      <div className="mt-4 text-xs font-medium uppercase tracking-[0.24em] text-current/65">
        {footer}
      </div>
    </>
  )

  if (disabled) {
    return (
      <button type="button" disabled aria-disabled="true" className={baseClassName}>
        {content}
      </button>
    )
  }

  if (!href) {
    return <div className={baseClassName}>{content}</div>
  }

  return (
    <Link href={href} className={baseClassName}>
      {content}
    </Link>
  )
}
