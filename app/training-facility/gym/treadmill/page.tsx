import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { TreadmillDetailView } from '@/components/training-facility/gym/TreadmillDetailView'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * Treadmill detail view (PRD §7.4) — running-modality charts. Reachable from
 * the treadmill click target on the Gym scene; gated behind the Training
 * Facility feature flag for staged rollout.
 *
 * The client island is wrapped in `<Suspense>` because it reads
 * `useSearchParams()` for the `?preview=demo` empty-state affordance
 * (#162). Without the boundary, Next 15+ would opt the entire page
 * out of static rendering at build time. The fallback is `null` —
 * `TreadmillDetailView` already owns its own `LoadingPanel`.
 */
export default function TrainingFacilityGymTreadmillPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return (
    <Suspense fallback={null}>
      <TreadmillDetailView />
    </Suspense>
  )
}
