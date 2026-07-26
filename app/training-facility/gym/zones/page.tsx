import type { JSX } from 'react'
import { notFound } from 'next/navigation'

import { HrZoneComparison } from '@/components/training-facility/gym/HrZoneComparison'
import { getCardioDataServer } from '@/lib/data/cardio-server'
import { getOtfDataServer } from '@/lib/data/otf-server'
import { firstRejectionMessage, settledOr } from '@/lib/data/settled'
import { isGymEnabled } from '@/lib/feature-flags'

/**
 * HR-zone reconciliation view (#261) — Apple Watch vs OrangeTheory zones on one
 * shared, data-derived max HR. Reached from a link in the OrangeTheory detail
 * view; gated behind the Gym feature flag for staged rollout, matching the
 * sibling gym detail pages.
 *
 * Reads both datasets server-side and passes them down (#345). The view used to
 * fetch them from a mount effect, which pulled the browser Supabase client —
 * and therefore `NEXT_PUBLIC_SUPABASE_ANON_KEY` — into a publicly reachable
 * bundle.
 *
 * A rejection is caught and forwarded as a message rather than rethrown: the
 * view renders its own error panel inside the page shell, so a read failure
 * keeps the header, the back links, and the explanatory copy instead of
 * replacing the whole route with an error boundary. `null` from either reader
 * means "empty table", which is a normal state the view handles.
 */
export default async function TrainingFacilityGymZonesPage(): Promise<JSX.Element> {
  if (!isGymEnabled()) notFound()

  const [cardioResult, otfResult] = await Promise.allSettled([
    getCardioDataServer(),
    getOtfDataServer(),
  ])

  return (
    <HrZoneComparison
      cardio={settledOr(cardioResult, null)}
      otf={settledOr(otfResult, null)}
      loadError={firstRejectionMessage(cardioResult, otfResult)}
    />
  )
}
