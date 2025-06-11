'use client'

import { useRouter } from 'next/navigation'

/**
 * BackToCourtButton renders a themed button that returns to the homepage.
 */
export function BackToCourtButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push('/')}
      className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-black hover:bg-orange-600 text-white hover:bg-orange-500 active:scale-95 transition shadow-sm whitespace-nowrap cursor-pointer"
    >
      🏀 Back to Home Court
    </button>
  )
}
