import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
import { TreadmillDetailView } from '@/components/training-facility/gym/TreadmillDetailView'
import { notFound } from 'next/navigation'

/**
 * Treadmill detail view (PRD §7.4) — running-modality charts. Reachable from
 * the treadmill click target on the Gym scene; gated behind the Training
 * Facility feature flag for staged rollout.
 */
export default function TrainingFacilityGymTreadmillPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return <TreadmillDetailView />
}
