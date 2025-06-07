import { useEffect, useState } from 'react'

export function useHasSeenIntro() {
  const [ready, setReady] = useState(false)
  const [showIntro, setShowIntro] = useState(false)

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

  return { ready, showIntro }
}