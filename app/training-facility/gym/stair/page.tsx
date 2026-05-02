import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { StairDetailView } from '@/components/training-facility/gym/StairDetailView'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

/**
 * Renders the Stair Climber detail view (PRD §7.4) — the first Gym detail
 * surface. Click-from-scene wiring lands once issue #61 (Gym scene SVG) is in.
 * Until then the route is reachable directly and via a temporary CTA on
 * `/training-facility/gym`.
 *
 * The client island is wrapped in `<Suspense>` because it reads
 * `useSearchParams()` for the `?preview=demo` empty-state affordance
 * (#162). Without the boundary, Next 15+ would opt the entire page
 * out of static rendering at build time. The fallback is `null` —
 * `StairDetailView` already owns its own `LoadingPanel`.
 */
export default function TrainingFacilityGymStairPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return (
    <Suspense fallback={null}>
      <StairDetailView />
    </Suspense>
  )
}
