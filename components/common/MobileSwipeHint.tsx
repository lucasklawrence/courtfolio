'use client'

import React, { useEffect, useState } from 'react'

const STORAGE_KEY = 'courtfolio:swipe-hint-dismissed'
const MQL_QUERY = '(max-width: 767px) and (orientation: portrait)'

export const MobileSwipeHint: React.FC = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') return
    } catch {}
    const mql = window.matchMedia(MQL_QUERY)
    if (!mql.matches) return
    setVisible(true)
  }, [])

  useEffect(() => {
    if (!visible) return
    const dismiss = () => {
      setVisible(false)
      try {
        window.localStorage.setItem(STORAGE_KEY, '1')
      } catch {}
    }
    const mql = window.matchMedia(MQL_QUERY)
    const timer = window.setTimeout(dismiss, 4000)
    window.addEventListener('touchmove', dismiss, { passive: true })
    mql.addEventListener('change', dismiss)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('touchmove', dismiss)
      mql.removeEventListener('change', dismiss)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm"
    >
      Swipe to explore →
    </div>
  )
}
