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

  // Go to next step
  const nextStep = useCallback(() => {
    if (tourStep < tourSteps.length - 1) {
      setTourStep(prev => prev + 1)
    } else {
      stopTour()
    }
  }, [tourStep])

  // Stop tour and mark as seen
  const stopTour = useCallback(() => {
    setTourActive(false)
    markAsSeen()
  }, [markAsSeen])

  // Auto-start if user has not seen yet
  useEffect(() => {
    if (hasSeen === false) {
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
