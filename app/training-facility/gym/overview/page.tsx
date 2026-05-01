import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
import { AllCardioOverview } from '@/components/training-facility/gym/AllCardioOverview'
import { notFound } from 'next/navigation'

/**
 * Renders the All Cardio overview / stats wall (PRD §7.4) — the cross-activity
 * Gym surface. Reachable from the Gym scene's wall scoreboard and from a
 * `View all cardio →` pill on `/training-facility/gym`.
 */
export default function TrainingFacilityGymOverviewPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return <AllCardioOverview />
}
