'use client'

import { CourtSvg } from './CourtSvg'
import { useRouter } from 'next/navigation'
import { ReplayIntroButton } from './ReplayIntroButton'
import { CourtTitle } from './CourtTitle'
import { CourtContainer } from './CourtContainer'
import React from 'react'

export function HomeBody() {
  const router = useRouter()

  return (
    <CourtContainer>
      <CourtSvg
        className="w-full h-full"
        onZoneClick={zoneId => {
          if (zoneId === '106' || zoneId === '107') {
            router.push('/about')
          }
        }}
        zoneContent={{
          'zone-106': (
            <foreignObject x="690" y="480" width="130" height="70">
              {React.createElement(
                'div',
                { xmlns: 'http://www.w3.org/1999/xhtml' },
                <button
                  className="w-full h-full bg-orange-950/70 backdrop-blur-sm text-white font-semibold text-sm px-4 py-2 rounded-lg border border-orange-500/30 shadow-sm text-center cursor-pointer hover:text-orange-300 transition"
                  onClick={() => router.push('/about')}
                >
                  ⛹️‍♂️ About Me
                </button>
              )}
            </foreignObject>
          ),
          'zone-78': (
            <foreignObject x={610} y={940} width={320} height={70}>
              {React.createElement(
                'div',
                { xmlns: 'http://www.w3.org/1999/xhtml' },
                <div className="flex flex-col items-center justify-center bg-white/90 text-black rounded-xl px-4 py-2 shadow-lg text-xs font-medium space-y-1 hover:bg-orange-100 transition">
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
              )}
            </foreignObject>
          ),

          'zone-90': (
            <foreignObject x={110} y={225} width={230} height={500}>
              <div className="p-4 bg-orange-900/30 text-white text-xs font-semibold rounded-md border border-orange-400/30 shadow-sm tracking-wide space-y-1">
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
          'zone-91': (
            <foreignObject x={1175} y={225} width={230} height={500}>
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
          ),
          'zone-99': (
            <foreignObject x="1250" y="880" width="180" height="50">
              <ReplayIntroButton />
            </foreignObject>
          ),
          'zone-84': (
            <foreignObject x="800" y="700" width="250" height="120">
              <div
                className="bg-orange-800/80 backdrop-blur-sm text-white p-4 rounded-lg border border-orange-400/30 shadow-md hover:scale-105 transition transform cursor-pointer"
                onClick={() => router.push('/projects')}
              >
                <h3 className="text-center font-bold text-orange-300 text-sm">🎨 Projects</h3>
                <p className="text-xs text-center mt-1 text-white/90 leading-snug">
                  Explore my plays — featuring Bars of the Day and more.
                </p>
              </div>
            </foreignObject>
          ),
          'zone-50': (
            <foreignObject x="600" y="0" width="350" height="100">
              <CourtTitle title="Lucas Lawrence" subtitle="Welcome to the Court" />
            </foreignObject>
          ),
        }}
      />
    </CourtContainer>
  )
}
