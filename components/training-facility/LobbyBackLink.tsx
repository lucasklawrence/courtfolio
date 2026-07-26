import type { JSX } from 'react'
import Link from 'next/link'

import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * The `← Training Facility` link back to the lobby, rendered only when the
 * lobby is actually reachable (#345).
 *
 * Every sub-area page carries this link, but the lobby sits behind
 * {@link isTrainingFacilityEnabled} while the Gym and Weight Room now have
 * their own flags. Publishing one area without the lobby would otherwise leave
 * a prominent, labelled link straight into a 404 — the failure mode that comes
 * with splitting a flag, since each page was written when one flag governed
 * every destination.
 *
 * Returning `null` is safe rather than stranding the visitor: every page that
 * renders this also renders a `BackToCourtButton`, so there is always a way
 * out.
 *
 * A Server Component — the flag is read at render, and nothing here needs to
 * hydrate.
 */
export function LobbyBackLink(): JSX.Element | null {
  if (!isTrainingFacilityEnabled()) return null

  return (
    <Link
      href="/training-facility"
      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80 transition hover:bg-white/10"
    >
      ← Training Facility
    </Link>
  )
}
