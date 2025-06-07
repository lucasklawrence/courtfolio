'use client'

import { useState } from 'react'
import { CourtSvg } from './CourtSvg'

export function HomeBody() {
  const [showAbout, setShowAbout] = useState(false)

  return (
    <div className="relative w-full h-screen">
  <CourtSvg />

  {/* Position above Zone 78/79 */}
  <div
  className="absolute text-white text-4xl font-bold"
  style={{
    top: '8%', // a bit above zone 78/79
    left: '50%',
    transform: 'translateX(-50%)',
  }}
>
  Welcome to the Court
</div>
</div>
  )
}
