'use client'

import Link from 'next/link'

/**
 * Stable identifier for each non-home room participating in the inter-room
 * "Next stop" navigation. The home court itself is reached via
 * {@link BackToCourtButton}, so it is intentionally absent from this set.
 */
export type RoomKey = 'rafters' | 'locker-room' | 'projects' | 'contact'

/**
 * Display metadata for a sibling room chip. Icons mirror the home court's
 * existing entry buttons (`useZoneContent`) so the inter-room link graph
 * reads as the same vocabulary the visitor saw on the court.
 */
type RoomMeta = {
  /** Internal route, consumed by `next/link`. */
  href: string
  /** Emoji glyph rendered before the label; decorative only (`aria-hidden`). */
  icon: string
  /** Visible chip label and accessible name for the link. */
  label: string
}

const ROOMS: Record<RoomKey, RoomMeta> = {
  rafters: { href: '/banners', icon: '🏟️', label: 'Rafters' },
  'locker-room': { href: '/locker-room', icon: '🧳', label: 'Locker Room' },
  projects: { href: '/projects', icon: '🎨', label: 'Project Binder' },
  contact: { href: '/contact', icon: '📫', label: 'Front Office' },
}

/**
 * Stable display order — siblings are rendered in this order with the
 * `current` room filtered out, so each room's chip strip reads consistently
 * regardless of which room the visitor is on.
 */
const ORDER: readonly RoomKey[] = ['rafters', 'locker-room', 'projects', 'contact']

export interface NextStopNavProps {
  /** The room currently being rendered. Filtered out of the chip list. */
  current: RoomKey
  /** Optional Tailwind classes appended to the root `<nav>` element. */
  className?: string
}

/**
 * Renders a horizontal "Next stop" chip strip linking to the other rooms in
 * the site. Each non-home room embeds this nav so visitors can hop directly
 * between rooms without bouncing through the court, and so the internal link
 * graph fans out symmetrically for SEO.
 *
 * Uses `next/link` for client-side navigation and crawler-friendly `<a>`
 * tags. The `<nav>` element carries `aria-label="Other rooms"` so assistive
 * tech can distinguish this strip from the existing "Back to Home Court"
 * button it sits alongside.
 */
export function NextStopNav({ current, className }: NextStopNavProps) {
  const siblings = ORDER.filter(key => key !== current)

  return (
    <nav
      aria-label="Other rooms"
      className={`flex flex-wrap items-center gap-2 ${className ?? ''}`}
    >
      <span className="text-[10px] font-mono uppercase tracking-widest text-white/70">
        Next stop
      </span>
      {siblings.map(key => {
        const room = ROOMS[key]
        return (
          <Link
            key={key}
            href={room.href}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-orange-500 sm:text-sm"
          >
            <span aria-hidden="true">{room.icon}</span>
            <span>{room.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
