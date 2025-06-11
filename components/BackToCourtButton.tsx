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
      className="px-4 py-2 rounded-full text-sm sm:text-base bg-black text-white hover:bg-orange-600 active:scale-95 transition shadow-md cursor-pointer"
    >
      🏀 Back to the Court
    </button>
  )
}
