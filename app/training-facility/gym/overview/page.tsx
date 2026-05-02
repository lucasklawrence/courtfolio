import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { AllCardioOverview } from '@/components/training-facility/gym/AllCardioOverview'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * Renders the All Cardio overview / stats wall (PRD §7.4) — the cross-activity
 * Gym surface. Reachable from the Gym scene's wall scoreboard and from a
 * `View all cardio →` pill on `/training-facility/gym`.
 *
 * The client island is wrapped in `<Suspense>` because it reads
 * `useSearchParams()` for the `?preview=demo` empty-state affordance
 * (#162). Without the boundary, Next 15+ would opt the entire page
 * out of static rendering at build time. The fallback is `null` —
 * `AllCardioOverview` already owns its own `LoadingPanel`.
 */
export default function TrainingFacilityGymOverviewPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return (
    <Suspense fallback={null}>
      <AllCardioOverview />
    </Suspense>
  )
}
