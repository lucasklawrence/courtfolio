'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import Link from 'next/link'
import { CourtZone } from '../CourtZone'
import { ZoneBioCard } from '../ZoneBioCard'
import { ZoneCareerStats } from '../ZoneCareerStats'
import { ZoneProjects } from '../ZoneProjects'
import { ReplayIntroButton } from '../ReplayIntroButton'
import { CourtTitleSolo } from '../CourtTitleSolo'
import { SafeSvgHtml } from '../SafeSvgHtml'
import { LogoSvg } from '../LogoSvg'

type ZoneContentMap = Record<string, React.ReactNode>

type UseZoneContentProps = {
  tourActive: boolean
  tourStep: number
  isMobile: boolean
  hasSeen: boolean | null
  markAsSeen: () => void
  startTour: () => void
  stopTour: () => void
  nextStep: () => void
  reset: () => void
}

export function useZoneContent({
  tourActive,
  tourStep,
  isMobile,
  hasSeen,
  markAsSeen,
  startTour,
  stopTour,
  nextStep,
  reset,
}: UseZoneContentProps): ZoneContentMap {
  const router = useRouter()

  const baseZones = useMemo<ZoneContentMap>(
    () => ({
      'zone-106': (
        <CourtZone x={350} y={110} width={380} height={160}>
          <div id="bio-card">
            <ZoneBioCard />
          </div>
        </CourtZone>
      ),
      'zone-107': (
        <CourtZone x={800} y={110} width={280} height={160}>
          <div id="career-stats-card">
            <ZoneCareerStats />
          </div>
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
            <div id="scouting-area">
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
            </div>
          </SafeSvgHtml>
        </foreignObject>
      ),
      'zone-90': (
        <foreignObject x={110} y={425} width={230} height={500}>
          <div id="principles-lineup">
            <div className="p-3 bg-orange-900/30 text-white text-xs font-bold rounded-md border border-orange-300/40 shadow-sm tracking-wide">
              <h3 className="font-bold text-sm">🧠 Principles Lineup</h3>
              <ul className="list-disc list-inside">
                <li>#7 Clean Code (PG)</li>
                <li>#24 SoC (SG)</li>
                <li>#11 Scalability (SF)</li>
                <li>#13 Tests (PF)</li>
                <li>#35 Arch Consistency (C)</li>
              </ul>
            </div>
          </div>
        </foreignObject>
      ),
      'zone-91': (
        <foreignObject x={1175} y={425} width={230} height={500}>
          <div id="tech-stack-lineup">
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
          <div id="projects">
            <ZoneProjects />
          </div>
        </CourtZone>
      ),
      'zone-50': (
        <foreignObject x="600" y="20" width="350" height="100">
          <CourtTitleSolo title="Welcome to the Court" />
        </foreignObject>
      ),
      'zone-85': (
        <CourtZone x={1020} y={40} width={220} height={100} className="ui-layer z-[110]">
          <SafeSvgHtml>
            <button
              id="view-rafters"
              onClick={() => {
                window.location.href = '/banners'
              }}
              className="cursor-pointer bg-[#42210b] text-yellow-300 font-semibold px-5 py-3 rounded-xl shadow hover:bg-[#5a3015] transition text-center text-base sm:text-lg"
            >
              🏟️ View the Rafters
            </button>
          </SafeSvgHtml>
        </CourtZone>
      ),
      'zone-86': (
        <CourtZone x={1270} y={40} width={300} height={100} className="ui-layer z-[110]">
          <SafeSvgHtml>
            <button
              id="enter-locker-room"
              onClick={() => {
                window.location.href = '/locker-room'
              }}
              className="cursor-pointer  bg-[#42210b] text-yellow-300 font-semibold px-5 py-3 rounded-xl shadow hover:bg-[#5a3015] transition text-center text-base sm:text-lg"
            >
              👟 Enter Locker Room
            </button>
          </SafeSvgHtml>
        </CourtZone>
      ),
    }),
    [router]
  )

  const zoneContent: ZoneContentMap = { ...baseZones }

  if (tourActive) {
    if (!isMobile) {
      zoneContent['zone-9000'] = (
        <CourtZone x={950} y={865} width={200} height={40} className="ui-layer z-[100]">
          <SafeSvgHtml>
            <div className="flex justify-end items-center gap-3 w-full h-full">
              <button
                onClick={nextStep}
                className="px-4 py-1 text-sm sm:text-base font-semibold text-white bg-orange-600 rounded-full hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
              >
                →
              </button>
              <button
                onClick={() => {
                  stopTour()
                  markAsSeen()
                }}
                className="px-4 py-1 text-sm sm:text-base font-semibold text-white bg-orange-600 rounded-full hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
              >
                Skip
              </button>
            </div>
          </SafeSvgHtml>
        </CourtZone>
      )
    }
  } else {
    zoneContent['zone-101'] = (
      <CourtZone x={1050} y={870} width={180} height={70}>
        <SafeSvgHtml>
          <div className="flex flex-col items-center">
            {hasSeen && (
              <button
                onClick={() => {
                  reset()
                  startTour()
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

  return zoneContent
}
