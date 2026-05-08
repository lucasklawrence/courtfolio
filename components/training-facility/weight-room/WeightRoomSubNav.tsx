import type { JSX } from 'react'
import Link from 'next/link'

/**
 * Identifier for the active Weight Room sub-page (#82). Drives which
 * pill in the sub-nav renders in the active style. Each value
 * corresponds to one of the three routes under
 * `/training-facility/weight-room/*`.
 */
export type WeightRoomSubNavSection = 'today' | 'history' | 'settings'

/** Props for {@link WeightRoomSubNav}. */
export interface WeightRoomSubNavProps {
  /**
   * The section the rendering page represents — that pill gets the
   * active treatment, the others render as quiet links. Required so
   * each page declares its own identity rather than relying on
   * pathname-sniffing.
   */
  active: WeightRoomSubNavSection
  /**
   * Optional Tailwind classes appended to the outer `<nav>`. Lets
   * a page tweak vertical spacing without rewriting the chrome.
   */
  className?: string
}

interface SubNavItem {
  section: WeightRoomSubNavSection
  label: string
  href: string
}

/**
 * Three Weight Room sub-routes (#80, #81, #79) in display order. The
 * order matches the user's natural flow: Today is the centerpiece,
 * History contextualizes it, Settings is admin-only configuration.
 */
const ITEMS: readonly SubNavItem[] = [
  { section: 'today', label: 'Today', href: '/training-facility/weight-room' },
  { section: 'history', label: 'History', href: '/training-facility/weight-room/history' },
  { section: 'settings', label: 'Settings', href: '/training-facility/weight-room/settings' },
]

/**
 * Pill-row sub-nav for the Weight Room area (#82). Renders three
 * rounded pills (Today / History / Settings) under the page header so
 * a viewer can flip between the sub-pages without bouncing back to the
 * Training Facility shell.
 *
 * Visual: cream-on-amber for the active pill (matches the existing
 * "View all cardio →" CTA on the Gym page), quiet white-on-translucent
 * for inactive pills. Uses Next `<Link>` so navigation is client-side
 * and prefetched — no `react-router-dom` despite the original issue
 * spec; the App Router gives the same UX without a new dependency.
 *
 * The `aria-current="page"` on the active pill announces section
 * identity to screen readers; sighted users see the same intent via
 * the amber tint.
 *
 * Mobile-first: pills wrap rather than scroll horizontally — three
 * short labels fit on a 390 px viewport without truncation.
 */
export function WeightRoomSubNav({ active, className = '' }: WeightRoomSubNavProps): JSX.Element {
  return (
    <nav
      aria-label="Weight Room sections"
      data-testid="weight-room-sub-nav"
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {ITEMS.map((item) => {
        const isActive = item.section === active
        const className = isActive
          ? 'rounded-full border border-amber-200/35 bg-amber-200/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-100'
          : 'rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/75 transition hover:bg-white/10 hover:text-white'
        return (
          <Link
            key={item.section}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={className}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
