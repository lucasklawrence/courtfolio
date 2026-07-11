import { useEffect, useState } from 'react'

export function useHasSeenIntro() {
  const [ready, setReady] = useState(false)
  const [showIntro, setShowIntro] = useState(false)

  // Intentional client-only localStorage read on mount: both state values stay
  // false during SSR and the first client render, then resolve post-hydration,
  // so there's no server/client mismatch.
  /* eslint-disable react-hooks/set-state-in-effect -- intentional post-hydration localStorage read; see comment above */
  useEffect(() => {
    try {
      const hasSeen = localStorage.getItem('hasSeenIntro')
      console.log('hasSeenIntro from localStorage:', hasSeen)

      if (!hasSeen) {
        setShowIntro(true)
        localStorage.setItem('hasSeenIntro', 'true')
      }
    } catch (err) {
      console.error('Error checking localStorage', err)
    } finally {
      setReady(true)
    }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  return { ready, showIntro }
}
