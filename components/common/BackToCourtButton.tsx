'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useScene } from '@/components/scene'

/**
 * BackToCourtButton triggers a scene transition back to the main court and syncs the URL.
 */
export function BackToCourtButton() {
  const { goToScene } = useScene()
  const router = useRouter()

  const handleClick = useCallback(() => {
    goToScene('court')
    router.push('/')
  }, [goToScene, router])

  return (
    <button
      onClick={handleClick}
      className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-black text-white hover:bg-orange-500 transition shadow-sm whitespace-nowrap cursor-pointer"
    >
      🏀 Back to Home Court
    </button>
  )
}
