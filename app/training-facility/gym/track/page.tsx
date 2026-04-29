import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
import { TrackDetailView } from '@/components/training-facility/gym/TrackDetailView'
import { notFound } from 'next/navigation'

/**
 * Track detail view (PRD §7.4) — walking-modality charts. Reachable from the
 * indoor-track click target on the Gym scene; gated behind the Training
 * Facility feature flag for staged rollout.
 */
export default function TrainingFacilityGymTrackPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return <TrackDetailView />
}
