'use client'

import Link from 'next/link'

/**
 * BackToCourtButton renders a themed button that returns to the homepage.
 */
export function BackToCourtButton() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm rounded-full border border-white/40 bg-white/10 backdrop-blur-sm text-white hover:border-orange-300 hover:bg-orange-500 transition shadow-sm whitespace-nowrap cursor-pointer"
    >
      🏀 Home Court
    </Link>
  )
}
