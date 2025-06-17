'use client'

import { CourtSvg } from './court/CourtSvg'
import { useRouter } from 'next/navigation'
import { ReplayIntroButton } from './ReplayIntroButton'
import { CourtContainer } from './court/CourtContainer'
import React, { useEffect, useRef, useState } from 'react'
import { ZoneProjects } from './ZoneProjects'
import { CourtZone } from './CourtZone'
import Link from 'next/link'
import { ZoneBioCard } from './ZoneBioCard'
import { ZoneCareerStats } from './ZoneCareerStats'
import { LogoSvg } from './LogoSvg'
import { CourtTitleSolo } from './CourtTitleSolo'
import { CourtTutorialSprite } from './CourtTutorialSprite'
import { useHasSeenTour } from '@/utils/useHasSeenTour'
import { FreeRoamPlayer } from './court/FreeRoamPlayer'
import { SafeSvgHtml } from './SafeSvgHtml'
import { SvgGlowHighlight } from './SvgGlowingHighlight'
import { CourtInteractionLayer } from './court/CourtInteractionLayer'

export function HomeBody() {
  const router = useRouter()
  const { hasSeen, markAsSeen, reset } = useHasSeenTour()

  const [tourActive, setTourActive] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const [clickTarget, setClickTarget] = useState<{ x: number; y: number } | null>(null)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([])

  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (hasSeen === false) {
      setTourActive(true)
    }
  }, [hasSeen])
  const tourSteps = [
    {
      x: 610,
      y: 355,
      img: '/sprites/LucasDefense.png',
      text: 'Welcome to the court — I’m Lucas.',
      glow: { x: 350, y: 110, width: 380, height: 140 },
    },
    {
      x: 370,
      y: 250,
      img: '/sprites/LucasHoldingBall.png',
      text: 'This is my bio — quick overview of who I am.',
      glow: { x: 350, y: 110, width: 380, height: 140 },
      facingLeft: false,
    },
    {
      x: 810,
      y: 250,
      img: '/sprites/LucasSpinningBall.png',
      text: 'Stats don’t lie. Here’s the résumé highlight reel.',
      glow: { x: 800, y: 110, width: 280, height: 135 },
      facingLeft: false,
    },
    {
      x: 1270,
      y: 110,
      img: '/sprites/LucasShooting.png',
      text: 'Head to the locker room for more personal flavor.',
      glow: { x: 1270, y: 60, width: 240, height: 40 },
    },
    {
      x: 1020,
      y: 110,
      img: '/sprites/LucasShooting.png',
      text: 'Check the rafters — career moments and banners.',
      glow: { x: 1020, y: 60, width: 220, height: 40 },
      facingLeft: false,
    },
    {
      x: 1050,
      y: 350,
      img: '/sprites/LucasDribbling.png',
      text: 'Tech stack lineup. These are my go-to tools.',
      glow: { x: 1175, y: 425, width: 230, height: 135 },
    },
    {
      x: 650,
      y: 640,
      img: '/sprites/LucasDribbling.png',
      text: 'Explore the plays — featured projects live here.',
      glow: { x: 800, y: 700, width: 250, height: 100 },
      facingLeft: false,
    },
    {
      x: 610,
      y: 840,
      img: '/sprites/LucasDefense.png',
      text: 'Want to connect? Head to the front office.',
      glow: { x: 610, y: 940, width: 320, height: 55 },
      facingLeft: false,
    },
    {
      x: 130,
      y: 575,
      img: '/sprites/LucasDribbling.png',
      text: 'My core principles — this lineup shows how I play.',
      glow: { x: 110, y: 425, width: 230, height: 140 },
      facingLeft: false,
    },
    {
      x: 610,
      y: 355,
      img: '/sprites/LucasDefense.png',
      text: 'That’s the full tour. Go explore the court!',
    },
  ]

  useEffect(() => {
    const logClick = (e: MouseEvent) => {
      console.log('🌍 GLOBAL CLICK:', e.target)
    }

    window.addEventListener('click', logClick)
    return () => window.removeEventListener('click', logClick)
  }, [])

  const zoneContent: Record<string, React.ReactNode> = {
    'zone-106': (
      <CourtZone x={350} y={110} width={380} height={160}>
        <ZoneBioCard />
      </CourtZone>
    ),
    'zone-107': (
      <CourtZone x={800} y={110} width={280} height={160}>
        <ZoneCareerStats />
      </CourtZone>
    ),
    'zone-108': (
      <CourtZone x={610} y={355} width={300} height={300}>
        <LogoSvg />
      </CourtZone>
    ),
    'zone-78': (
      <foreignObject x={610} y={940} width={320} height={70}>
        <SafeSvgHtml>
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
        </SafeSvgHtml>
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
        <div className="relative z-10">
          <Link
            href="/banners"
            className="bg-[#42210b] text-yellow-300 font-semibold px-5 py-3 rounded-xl shadow hover:bg-[#5a3015] transition transform text-center text-base sm:text-lg"
          >
            🏟️ View the Rafters
          </Link>
        </div>
      </CourtZone>
    ),
    'zone-86': (
      <CourtZone x={1270} y={60} width={300} height={200}>
        <div className="relative z-10">
          <Link
            href="/locker-room"
            className="bg-[#42210b] text-yellow-300 font-semibold px-5 py-3 rounded-xl shadow hover:bg-[#5a3015] transition transform text-center text-base sm:text-lg"
          >
            👟 Enter Locker Room
          </Link>
        </div>
      </CourtZone>
    ),
  }

   if (tourActive) {
    zoneContent['zone-1000'] = (
      <>
        {tourSteps[tourStep].glow && (
          <SvgGlowHighlight {...tourSteps[tourStep].glow} />
        )}
      </>
    )
  } else {
    zoneContent['zone-101'] = (
      <CourtZone x={1050} y={870} width={180} height={70}>
        <SafeSvgHtml>
          <div className="flex flex-col items-center">
            {!tourActive && hasSeen && (
              <button
                onClick={() => {
                  reset()
                  setTourStep(0)
                  setTourActive(true)
                }}
                className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-orange-600 text-white hover:bg-orange-500 transition shadow-sm whitespace-nowrap cursor-pointer"
              >
                🔁 Replay Tour
              </button>
            )}
          </div>
        </SafeSvgHtml>
      </CourtZone>
    )
  } 


 return (
    <CourtContainer>
      <CourtSvg ref={svgRef} className="w-full h-full" zoneContent={zoneContent} ripples={ripples}/>

      <CourtInteractionLayer
        svgRef={svgRef}
        setClickTarget={setClickTarget}
        setRipples={setRipples}
      />

      {tourActive && (
  <div className="absolute top-0 left-0 w-full h-full z-50 pointer-events-auto">
    <CourtTutorialSprite
      svgRef={svgRef}
      stepData={tourSteps[tourStep]}
      onNext={() => {
        if (tourStep < tourSteps.length - 1) {
          setTourStep(prev => prev + 1)
        } else {
          setTourActive(false)
          markAsSeen()
        }
      }}
      onSkip={() => {
        setTourActive(false)
        markAsSeen()
      }}
    />
  </div>
)}


      {!tourActive && (
        <div className="absolute top-0 left-0 w-full h-full z-50 pointer-events-none">
          <FreeRoamPlayer boundsRef={svgRef} target={clickTarget} />
        </div>
      )}
    </CourtContainer>
  )
}