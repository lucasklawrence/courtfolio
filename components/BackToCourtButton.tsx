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
                    className="px-4 py-1.5 rounded-full text-sm bg-black text-white hover:bg-orange-600 transition shadow-md"
    >
      🏀 Back to the Court
    </button>
  )
}
