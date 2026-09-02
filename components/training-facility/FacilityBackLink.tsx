import type { JSX } from 'react'
import Link from 'next/link'

import { isGymEnabled, isTrainingFacilityEnabled, isWeightRoomEnabled } from '@/lib/feature-flags'

/**
 * The "up one level" link every Training Facility sub-page carries, pointed at
 * whichever parent is actually reachable (#345).
 *
 * There are two candidate parents and neither is guaranteed to exist. The
 * tracking hub (`/training-facility/tracking`) is live whenever the Gym or the
 * Weight Room is, and is the better destination for a visitor who arrived at a
 * data surface — it's the page that introduces them. The lobby
 * (`/training-facility`) covers the whole facility including the Combine, but
 * sits behind its own flag while its corridor is being designed.
 *
 * So: hub first, lobby as fallback, and nothing at all when neither is up.
 * Rendering nothing is safe rather than stranding: every page that uses this
 * also renders a {@link import('@/components/common/BackToCourtButton').BackToCourtButton},
 * so there is always a way out.
 *
 * A Server Component — the flags are read at render and nothing here hydrates.
 */
export function FacilityBackLink(): JSX.Element | null {
  const hubLive = isGymEnabled() || isWeightRoomEnabled()
  const lobbyLive = isTrainingFacilityEnabled()

  if (!hubLive && !lobbyLive) return null

  const { href, label } = hubLive
    ? { href: '/training-facility/tracking', label: '← Tracking' }
    : { href: '/training-facility', label: '← Training Facility' }

  return (
    <Link
      href={href}
      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
    >
      {label}
    </Link>
  )
}
