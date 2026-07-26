import type { JSX } from 'react'
import Link from 'next/link'

/** Props for {@link TrackingHubCard}. */
export interface TrackingHubCardProps {
  /** Small mono label above the title, e.g. `Strength`. */
  eyebrow: string
  /** Card title — the surface's name as the visitor will see it. */
  title: string
  /** One or two sentences on what the surface shows and why it's interesting. */
  description: string
  /** Route this card opens. Callers only render a card whose area is live. */
  href: string
  /** Hex accent for the eyebrow and the hover border — the surface's own colour. */
  accent: string
  /** Emoji shown beside the title. On-brand iconography; see the design system. */
  icon: string
}

/**
 * One surface on the tracking hub — an anchor styled as a card.
 *
 * The whole card is the link rather than a "read more" affordance inside it, so
 * the hit target matches the visual target. `group-hover` lifts the border to
 * the surface's own accent, which is also what ties the card to the page it
 * opens (the Trophy Room's amber, OrangeTheory's orange).
 */
export function TrackingHubCard({
  eyebrow,
  title,
  description,
  href,
  accent,
  icon,
}: TrackingHubCardProps): JSX.Element {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-[1.2rem] border border-white/10 bg-white/5 p-5 transition hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
      style={{ borderColor: undefined }}
    >
      <span
        className="font-mono text-[10px] font-semibold uppercase tracking-[0.28em]"
        style={{ color: accent }}
      >
        {eyebrow}
      </span>
      <span className="mt-2 flex items-center gap-2 text-lg font-black uppercase tracking-[0.04em] text-[#fff7ec]">
        <span aria-hidden="true" className="text-base">
          {icon}
        </span>
        {title}
      </span>
      <span className="mt-2 flex-1 text-sm leading-6 text-[#e8d5be]/80">{description}</span>
      <span
        className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] transition group-hover:translate-x-0.5"
        style={{ color: accent }}
      >
        Open →
      </span>
    </Link>
  )
}
