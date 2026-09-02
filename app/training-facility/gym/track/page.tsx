import { Suspense, type JSX } from 'react'
import { notFound } from 'next/navigation'

import { TrackDetailView } from '@/components/training-facility/gym/TrackDetailView'
import { getCardioDataServer } from '@/lib/data/cardio-server'
import { getMovementBenchmarksServer } from '@/lib/data/movement-server'
import { firstRejectionMessage, settledOr } from '@/lib/data/settled'
import { isGymEnabled } from '@/lib/feature-flags'

/**
 * Track detail view (PRD §7.4) — walking-modality charts. Reachable from the
 * indoor-track click target on the Gym scene; gated behind the Gym feature flag
 * for staged rollout.
 *
 * Reads both datasets server-side and passes them down (#345). The view used to
 * fetch them from a mount effect, which pulled the browser Supabase client —
 * and therefore `NEXT_PUBLIC_SUPABASE_ANON_KEY` — into a publicly reachable
 * bundle.
 *
 * A rejection is caught and forwarded as a message rather than rethrown: the
 * view renders its own error panel inside the page shell, so a read failure
 * keeps the surrounding chrome instead of replacing the route with an error
 * boundary. `null` from the cardio reader means "every cardio table is empty",
 * which is a normal state the view handles.
 *
 * The island stays wrapped in `<Suspense>` because it reads `useSearchParams()`
 * for the `?preview=demo` empty-state affordance (#162). Without the boundary,
 * Next would opt the whole page out of static rendering.
 */
export default async function TrainingFacilityGymTrackPage(): Promise<JSX.Element> {
  if (!isGymEnabled()) notFound()

  const [cardioResult, benchmarksResult] = await Promise.allSettled([
    getCardioDataServer(),
    getMovementBenchmarksServer(),
  ])

  return (
    <Suspense fallback={null}>
      <TrackDetailView
        cardio={settledOr(cardioResult, null)}
        benchmarks={settledOr(benchmarksResult, [])}
        loadError={firstRejectionMessage(cardioResult, benchmarksResult)}
      />
    </Suspense>
  )
}
