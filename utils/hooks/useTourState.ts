'use client'

import { useEffect, useState, useCallback } from 'react'
import { tourSteps } from '@/constants/tourSteps'

type Props = {
  hasSeen: boolean | null
  markAsSeen: () => void
}

export function useTourState({ hasSeen, markAsSeen }: Props) {
  const [tourActive, setTourActive] = useState(false)
  const [tourStep, setTourStep] = useState(0)

  // Start tour manually
  const startTour = useCallback(() => {
    setTourActive(true)
    setTourStep(0)
  }, [])

  // Stop tour and mark as seen. Declared before `nextStep` so the latter can
  // depend on a stable, already-initialized reference.
  const stopTour = useCallback(() => {
    setTourActive(false)
    markAsSeen()
  }, [markAsSeen])

  // Go to next step
  const nextStep = useCallback(() => {
    if (tourStep < tourSteps.length - 1) {
      setTourStep(prev => prev + 1)
    } else {
      stopTour()
    }
  }, [tourStep, stopTour])

  // Auto-start once the persisted "has seen" flag resolves to `false`. This
  // reacts to an async localStorage read (hasSeen: null -> false), so it can't
  // be derived during render or seeded as initial state without reintroducing
  // an SSR/hydration mismatch.
  useEffect(() => {
    if (hasSeen === false) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reacts to an async-loaded persisted flag; see comment above
      startTour()
    }
  }, [hasSeen, startTour])

  return {
    tourActive,
    tourStep,
    startTour,
    nextStep,
    stopTour,
  }
}
