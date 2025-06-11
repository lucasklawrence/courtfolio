'use client'

import Link from 'next/link'

/**
 * BackToCourtButton renders a themed button that returns to the homepage.
 */
export function BackToCourtButton() {

  return (
    <Link
      href="/"
      className="px-4 py-2 rounded-full text-sm sm:text-base bg-black text-white hover:bg-orange-600 active:scale-95 transition shadow-md cursor-pointer inline-block"
    >
      🏀 Back to Home Court
    </Link>
  )
}
