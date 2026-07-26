import { Suspense, type JSX } from 'react'
import { notFound } from 'next/navigation'

import { AllCardioOverview } from '@/components/training-facility/gym/AllCardioOverview'
import { getCardioDataServer } from '@/lib/data/cardio-server'
import { firstRejectionMessage, settledOr } from '@/lib/data/settled'
import { isGymEnabled } from '@/lib/feature-flags'

/**
 * Renders the All Cardio overview / stats wall (PRD §7.4) — the cross-activity
 * Gym surface. Reachable from the Gym scene's wall scoreboard and from a
 * `View all cardio →` pill on `/training-facility/gym`.
 *
 * Reads the cardio dataset server-side and passes it down (#345). The view used
 * to fetch it from a mount effect, which pulled the browser Supabase client —
 * and therefore `NEXT_PUBLIC_SUPABASE_ANON_KEY` — into a publicly reachable
 * bundle.
 *
 * A rejection is forwarded as a message rather than rethrown: the view renders
 * its own error panel inside the page shell, so a read failure keeps the
 * surrounding chrome instead of replacing the route with an error boundary.
 * `null` means "every cardio table is empty", a normal state the view handles.
 *
 * The island stays wrapped in `<Suspense>` because it reads `useSearchParams()`
 * for the `?preview=demo` empty-state affordance (#162). Without the boundary,
 * Next would opt the whole page out of static rendering.
 */
export default async function TrainingFacilityGymOverviewPage(): Promise<JSX.Element> {
  if (!isGymEnabled()) notFound()

  const [cardioResult] = await Promise.allSettled([getCardioDataServer()])

  return (
    <Suspense fallback={null}>
      <AllCardioOverview
        cardio={settledOr(cardioResult, null)}
        loadError={firstRejectionMessage(cardioResult)}
      />
    </Suspense>
  )
}
