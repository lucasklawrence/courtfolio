'use client'

import type { JSX } from 'react'
import Link from 'next/link'

import { useAdminSession } from '@/lib/auth/use-admin-session'

/**
 * Identifier for the active Weight Room sub-page (#82, #197). Drives
 * which pill in the sub-nav renders in the active style. Each value
 * corresponds to one of the routes under
 * `/training-facility/weight-room/*`.
 */
export type WeightRoomSubNavSection = 'today' | 'history' | 'settings' | 'log'

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
  /** True when the pill should only render for admins. */
  adminOnly?: boolean
}

/**
 * Weight Room sub-routes in display order. Today + History are public.
 * Settings + Log are admin-only — they're hidden from non-admin viewers
 * so the routes don't even hint at their existence. The underlying
 * pages still gate themselves with `requireAdminPage()` so direct URL
 * hits 404 regardless of the nav state.
 */
const ITEMS: readonly SubNavItem[] = [
  { section: 'today', label: 'Today', href: '/training-facility/weight-room' },
  { section: 'history', label: 'History', href: '/training-facility/weight-room/history' },
  { section: 'log', label: 'Log', href: '/training-facility/weight-room/log', adminOnly: true },
  { section: 'settings', label: 'Settings', href: '/training-facility/weight-room/settings', adminOnly: true },
]

/**
 * Pill-row sub-nav for the Weight Room area (#82, #197). Renders the
 * Today / History pills for everyone; Settings + Log pills appear only
 * for admin viewers (resolved via {@link useAdminSession}). While the
 * admin check is in flight the admin-only pills stay hidden — better
 * to add them in than to flash them out.
 *
 * Visual: cream-on-amber for the active pill (matches the existing
 * "View all cardio →" CTA on the Gym page), quiet white-on-translucent
 * for inactive pills. The `aria-current="page"` on the active pill
 * announces section identity to screen readers; sighted users see the
 * same intent via the amber tint.
 *
 * Mobile-first: pills wrap rather than scroll horizontally — three /
 * four short labels fit on a 390 px viewport without truncation.
 */
export function WeightRoomSubNav({ active, className = '' }: WeightRoomSubNavProps): JSX.Element {
  const { isAdmin } = useAdminSession()
  const visibleItems = ITEMS.filter((item) => !item.adminOnly || isAdmin)
  return (
    <nav
      aria-label="Weight Room sections"
      data-testid="weight-room-sub-nav"
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {visibleItems.map((item) => {
        const isActive = item.section === active
        const pillClassName = isActive
          ? 'rounded-full border border-amber-200/35 bg-amber-200/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-100'
          : 'rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/75 transition hover:bg-white/10 hover:text-white'
        return (
          <Link
            key={item.section}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={pillClassName}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
