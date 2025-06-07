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
        x={620}
        y={480}
        width={150}
        height={50}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className="text-white font-bold text-sm cursor-pointer hover:text-orange-400 transition"
          style={{ textAlign: 'center' }}
          onClick={() => router.push('/about')}
        >
          ⛹️‍♂️ About Me
        </div>
      </foreignObject>
    ),
    "zone-78": (
  <foreignObject x={610} y={940} width={320} height={70}>
    <div
      xmlns="http://www.w3.org/1999/xhtml"
      className="flex flex-col items-center justify-center bg-white/90 text-black rounded-xl px-4 py-2 shadow-lg text-xs font-medium space-y-1 hover:bg-orange-100 transition"
    >
      <div className="text-[10px] text-neutral-500 uppercase tracking-wide">
        🕵️ Scouting Area
      </div>
      <div className="flex gap-4 text-sm">
        <button
          onClick={() => router.push('/contact')}
          className="hover:text-orange-500 transition"
        >
          📫 Contact Me
        </button>
        <button
          onClick={() => window.open('/LucasLawrenceResume.pdf', '_blank')}
          className="hover:text-orange-500 transition"
        >
          📄 Resume
        </button>
      </div>
    </div>
  </foreignObject>
),
    "zone-90": (
      <foreignObject
        x={110}
        y={225}
        width={230}
        height={500}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          className="p-4 bg-orange-900/30 text-white text-xs font-semibold rounded-md cursor-pointer border border-orange-400/30 shadow-sm tracking-wide space-y-1"
          onClick={() => router.push('/lineup')}
        >
          <h3 className="font-bold text-sm">🧠 Principles Lineup</h3>
          <ul className="list-disc list-inside">
            <li>#7 Clean Code (PG)</li>
            <li>#24 SoC (SG)</li>
            <li>#11 Scalability (SF)</li>
            <li>#13 Tests (PF)</li>
            <li>#35 Arch Consistency (C)</li>
          </ul>
        </div>
      </foreignObject>
    ),
    "zone-91": (
      <foreignObject
        x={1175}
        y={225}
        width={230}
        height={500}
      >
        <div className="p-3 bg-orange-900/30 text-white text-xs font-bold rounded-md border border-orange-300/40 shadow-sm tracking-wide">

          <h3 className="font-bold text-center text-lg">🧰 Tech Stack Lineup</h3>
          <ul className="list-disc list-inside text-xs">
            <li>#10 React (PG)</li>
            <li>#22 Spring Boot (SG)</li>
            <li>#33 Kafka (SF)</li>
            <li>#18 PostgreSQL (PF)</li>
            <li>#44 Kubernetes (C)</li>
          </ul>
        </div>
      </foreignObject>
    )
  }}
/>


  {/* Position above Zone 78/79 */}
<div
  className="absolute text-white text-4xl font-extrabold text-center"
  style={{
    top: '6%', // pulled slightly higher for visibility
    left: '50%',
    transform: 'translateX(-50%)',
  }}
>
  Lucas Lawrence <br />
  <span className="text-orange-400 text-2xl font-mono">Welcome to the Court</span>
</div>
</div>
  )
}
