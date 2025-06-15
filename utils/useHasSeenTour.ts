// utils/useHasSeenTour.ts
import { useEffect, useState } from 'react'

export function useHasSeenTour() {
  const [hasSeen, setHasSeen] = useState<boolean | null>(null)

  useEffect(() => {
    const seen = localStorage.getItem('hasSeenCourtTour')
    setHasSeen(seen === 'true')
  }, [])

  const markAsSeen = () => {
    localStorage.setItem('hasSeenCourtTour', 'true')
    setHasSeen(true)
  }

  const reset = () => {
    localStorage.removeItem('hasSeenCourtTour')
    setHasSeen(false)
  }

  return { hasSeen, markAsSeen, reset }
}
