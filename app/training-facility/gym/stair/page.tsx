import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
import { StairDetailView } from '@/components/training-facility/gym/StairDetailView'
import { notFound } from 'next/navigation'

/**
 * Renders the Stair Climber detail view (PRD §7.4) — the first Gym detail
 * surface. Click-from-scene wiring lands once issue #61 (Gym scene SVG) is in.
 * Until then the route is reachable directly and via a temporary CTA on
 * `/training-facility/gym`.
 */
export default function TrainingFacilityGymStairPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return <StairDetailView />
}
