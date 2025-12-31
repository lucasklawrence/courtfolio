'use client'

import Link from 'next/link'

/**
 * BackToCourtButton renders a themed button that returns to the homepage.
 */
export function BackToCourtButton() {
  return (
    <Link
      href="/"
      className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-black text-white hover:bg-orange-500 transition shadow-sm whitespace-nowrap cursor-pointer"
    >
      Back to Home Court
    </Link>
  )
}
