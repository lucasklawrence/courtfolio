// utils/useHasSeenTour.ts
import { useEffect, useState } from 'react'

export function useHasSeenTour() {
  const [hasSeen, setHasSeen] = useState<boolean | null>(null)

  useEffect(() => {
    const seen = localStorage.getItem('hasSeenCourtTour')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only localStorage read; starts null so SSR and first client render agree
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
