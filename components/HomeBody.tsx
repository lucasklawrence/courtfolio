'use client'

import { CourtSvg } from './CourtSvg'
import { useRouter } from 'next/navigation'
import { ReplayIntroButton } from './ReplayIntroButton'
import { CourtContainer } from './CourtContainer'
import React, { useState } from 'react'
import { ZoneProjects } from './ZoneProjects'
import { CourtZone } from './CourtZone'
import Link from 'next/link'
import { ZoneBioCard } from './ZoneBioCard'
import { ZoneCareerStats } from './ZoneCareerStats'
import { LogoSvg } from './LogoSvg'
import { CourtTitleSolo } from './CourtTitleSolo'
import { CourtTutorialSprite } from './CourtTutorialSprite'

function GlowingHighlight({
  x,
  y,
  width,
  height,
}: {
  x: number
  y: number
  width: number
  height: number
}) {
  return (
    <div
      className="absolute z-0 rounded-lg border-2 border-yellow-300/70 shadow-[0_0_20px_6px_rgba(252,211,77,0.5)] animate-pulse"
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
    />
  )
}

export function HomeBody() {
  const router = useRouter()
  const [tourStep, setTourStep] = useState(0)
const [tourActive, setTourActive] = useState(true)
const tourSteps = [
  {
    x: 610, y: 355,
    img: '/sprites/LucasDefense.png',
    text: 'Welcome to the court — I’m Lucas.',
      glow: { x: 350, y: 110, width: 380, height: 140 }, // 👈 matches CourtZone for Bio

  },
  {
    x: 370, y: 250,
    img: '/sprites/LucasHoldingBall.png',
    text: 'This is my bio — quick overview of who I am.',
          glow: { x: 350, y: 110, width: 380, height: 140 }, // 👈 matches CourtZone for Bio

  },
  {
    x: 810, y: 250,
    img: '/sprites/LucasSpinningBall.png',
    text: 'Stats don’t lie. Here’s the résumé highlight reel.',
          glow: { x: 800, y: 110, width: 280, height: 135 }, // 👈 matches CourtZone for Bio

  },
  {
    x: 1270, y: 110,
    img: '/sprites/LucasShooting.png',
    text: 'Head to the locker room for more personal flavor.',
    glow: { x: 1270, y: 60, width: 240, height: 40 }, // 👈 matches CourtZone for Bio

  },
  {
    x: 1020, y: 110,
    img: '/sprites/LucasShooting.png',
    text: 'Check the rafters — career moments and banners.',
          glow: { x: 350, y: 110, width: 380, height: 160 }, // 👈 matches CourtZone for Bio

  },
  {
    x: 1050, y: 350,
    img: '/sprites/LucasDribbling.png',
    text: 'Tech stack lineup. These are my go-to tools.',
          glow: { x: 350, y: 110, width: 380, height: 160 }, // 👈 matches CourtZone for Bio

  },
  {
    x: 650, y: 640,
    img: '/sprites/LucasDribbling.png',
    text: 'Explore the plays — featured projects live here.',
          glow: { x: 350, y: 110, width: 380, height: 160 }, // 👈 matches CourtZone for Bio

  },
  {
    x: 610, y: 840,
    img: '/sprites/LucasDefense.png',
    text: 'Want to connect? Head to the front office.',
          glow: { x: 350, y: 110, width: 380, height: 160 }, // 👈 matches CourtZone for Bio

  },
  {
    x: 130, y: 575,
    img: '/sprites/LucasDribbling.png',
    text: 'My core principles — this lineup shows how I play.',
          glow: { x: 350, y: 110, width: 380, height: 160 }, // 👈 matches CourtZone for Bio

  },
  {
    x: 610, y: 355,
    img: '/sprites/LucasDefense.png',
    text: 'That’s the full tour. Go explore the court!',

  },
]


  return (
    <CourtContainer>
      <CourtSvg
        className="w-full h-full"
        onZoneClick={zoneId => {}}
        zoneContent={{
          // Player Bio Card
          'zone-106': (
            <CourtZone x={350} y={110} width={380} height={160}>
              <ZoneBioCard />
            </CourtZone>
          ),

          // Stats Overview
          'zone-107': (
            <CourtZone x={800} y={110} width={280} height={160}>
              <ZoneCareerStats />
            </CourtZone>
          ),
          // Logo
          'zone-108': (
            <CourtZone x={610} y={355} width={300} height={300}>
              <LogoSvg />
            </CourtZone>
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
                      className="cursor-pointer hover:text-orange-500 transition"
                    >
                      📫 Contact Me
                    </button>
                    <button
                      onClick={() => window.open('/LucasLawrenceResume.pdf', '_blank')}
                      className="cursor-pointer hover:text-orange-500 transition"
                    >
                      📄 Resume
                    </button>
                  </div>
                </div>
              )}
            </foreignObject>
          ),

          'zone-90': (
            <foreignObject x={110} y={425} width={230} height={500}>
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
            <foreignObject x={1175} y={425} width={230} height={500}>
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
            <foreignObject x="1210" y="870" width="180" height="70">
              <ReplayIntroButton />
            </foreignObject>
          ),
          'zone-84': (
            <CourtZone x={800} y={700} width={250} height={120}>
              <ZoneProjects />
            </CourtZone>
          ),
          'zone-50': (
            <foreignObject x="600" y="20" width="350" height="100">
              <CourtTitleSolo title="Welcome to the Court" />
            </foreignObject>
          ),
          'zone-85': (
            <CourtZone x={1020} y={60} width={220} height={200}>
              <Link
                href="/banners"
                className="bg-[#42210b] text-yellow-300 font-semibold px-5 py-3 rounded-xl shadow hover:bg-[#5a3015] transition transform text-center text-base sm:text-lg"
              >
                🏟️ View the Rafters
              </Link>
            </CourtZone>
          ),
          'zone-86': (
            <CourtZone x={1270} y={60} width={300} height={200}>
              <Link
                href="/locker-room"
                className="bg-[#42210b] z-10 text-yellow-300 font-semibold px-5 py-3 rounded-xl shadow hover:bg-[#5a3015] transition transform text-center text-base sm:text-lg"
              >
                👟 Enter Locker Room
              </Link>
            </CourtZone>
          ),
          'zone-1000': (
  <CourtZone x={0} y={0} width={1600} height={1000}>
        {/* 🔦 Show glow behind current target */}
    {tourActive && tourSteps[tourStep].glow && (
      <GlowingHighlight {...tourSteps[tourStep].glow} />
    )}
    {tourActive && (
      <CourtTutorialSprite
        stepData={tourSteps[tourStep]}
        onNext={() => {
          if (tourStep < tourSteps.length - 1) {
            setTourStep(prev => prev + 1)
          } else {
            setTourActive(false)
          }
        }}
      />
    )}
  </CourtZone>
)

        }}
      />
    </CourtContainer>
  )
}
