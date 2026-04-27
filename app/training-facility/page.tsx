import { isTrainingFacilityEnabled } from '@/lib/feature-flags'
import { TrainingFacilityShell } from '@/components/training-facility/TrainingFacilityShell'
import { notFound } from 'next/navigation'

/**
 * Renders the top-level Training Facility shell scene.
 */
export default function TrainingFacilityPage() {
  if (!isTrainingFacilityEnabled()) notFound()

  return <TrainingFacilityShell />
}
