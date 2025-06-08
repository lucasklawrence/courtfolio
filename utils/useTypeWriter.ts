// utils/useTypewriter.ts
import { useEffect, useState, useRef } from 'react'

export function useTypewriter(text: string, speed = 50) {
  const [displayed, setDisplayed] = useState('')
  const index = useRef(0)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setDisplayed('')
    index.current = 0
    if (!text || typeof text !== 'string') return

    intervalRef.current = setInterval(() => {
      setDisplayed(prev => {
        const nextChar = text.charAt(index.current)
        index.current += 1

        const next = prev + nextChar
        if (index.current >= text.length && intervalRef.current) {
          clearInterval(intervalRef.current)
        }
        return next
      })
    }, speed)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [text, speed])

  return displayed
}
