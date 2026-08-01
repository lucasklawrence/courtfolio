import type { JSX } from 'react'
import Link from 'next/link'

/**
 * Identifier for the active Weight Room sub-page (#82, #197). Drives
 * which pill in the sub-nav renders in the active style. Each value
 * corresponds to one of the routes under
 * `/training-facility/weight-room/*`.
 */
export type WeightRoomSubNavSection = 'today' | 'history' | 'achievements' | 'settings' | 'log'

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
  /**
   * Whether the viewer is an admin — controls whether the Log and Settings
   * pills render at all.
   *
   * Required, and resolved by the *caller* on the server, because this
   * component used to call `useAdminSession` itself. That hook builds a
   * browser Supabase client to watch for auth changes, which inlines
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` into every bundle reaching it — and this
   * nav renders on all five Weight Room pages, three of which are public
   * (#345). Taking the answer as a prop is what keeps the key out of them.
   *
   * Public pages resolve it with `isAdminRequest()` from
   * `@/lib/auth/admin-session`. The admin-only pages can pass `true`
   * outright: `requireAdminPage()` has already 404'd anyone else, so if the
   * page is rendering, the viewer is an admin.
   */
  isAdmin: boolean
}

interface SubNavItem {
  section: WeightRoomSubNavSection
  label: string
  href: string
  /** True when the pill should only render for admins. */
  adminOnly?: boolean
}

/**
 * Weight Room sub-routes in display order. Today + History + Trophies
 * are public. Settings + Log are admin-only — they're hidden from
 * non-admin viewers so the routes don't even hint at their existence.
 * The underlying pages still gate themselves with `requireAdminPage()`
 * so direct URL hits 404 regardless of the nav state.
 */
const ITEMS: readonly SubNavItem[] = [
  { section: 'today', label: 'Today', href: '/training-facility/weight-room' },
  { section: 'history', label: 'History', href: '/training-facility/weight-room/history' },
  {
    section: 'achievements',
    label: 'Trophies',
    href: '/training-facility/weight-room/achievements',
  },
  { section: 'log', label: 'Log', href: '/training-facility/weight-room/log', adminOnly: true },
  {
    section: 'settings',
    label: 'Settings',
    href: '/training-facility/weight-room/settings',
    adminOnly: true,
  },
]

/**
 * Pill-row sub-nav for the Weight Room area (#82, #197). Renders the
 * Today / History / Trophies pills for everyone; Settings + Log pills
 * appear only for admin viewers. While a client-side admin check is in
 * flight the admin-only pills stay hidden — better to add them in than
 * to flash them out.
 *
 * Admin status arrives as a prop, resolved server-side by the caller — this
 * component deliberately holds no client-side Supabase dependency, because it
 * renders on three publicly reachable pages (#345). See
 * {@link WeightRoomSubNavProps.isAdmin}.
 *
 * No longer a Client Component: with the hook gone there is nothing to
 * hydrate, so it renders on the server as plain links.
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
export function WeightRoomSubNav({
  active,
  className = '',
  isAdmin,
}: WeightRoomSubNavProps): JSX.Element {
  const visibleItems = ITEMS.filter(item => !item.adminOnly || isAdmin)
  return (
    <nav
      aria-label="Weight Room sections"
      data-testid="weight-room-sub-nav"
      className={`flex flex-wrap gap-2 ${className}`}
    >
      {visibleItems.map(item => {
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
