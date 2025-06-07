'use client'

import { useState } from 'react'
import { CourtSvg } from './CourtSvg'
import { useRouter } from 'next/navigation' 

export function HomeBody() {
  const router = useRouter()

  return (
    <div className="relative w-full h-screen">
 <CourtSvg
        onZoneClick={(zoneId) => {
          if (zoneId === '106' || zoneId === '107') {
            router.push('/about')
          }
        }}
        zoneContent={{
    "zone-106": (
      <foreignObject
  x={620}       // Adjust for left-side center circle placement
  y={480}       // Adjust this value downward to move the label lower
  width={150}
  height={50}
>
  <div
    xmlns="http://www.w3.org/1999/xhtml"
    className="text-white font-bold text-sm cursor-pointer hover:text-orange-400 transition"
    onClick={() => router.push('/about')}
    style={{ textAlign: 'center'
    }}
  >
    ⛹️‍♂️  About Me
  </div>
</foreignObject>
    )
  }}
      />

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
