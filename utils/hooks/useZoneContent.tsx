'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { ReplayIntroButton } from '../../components/common/ReplayIntroButton'
import { SafeSvgHtml } from '../../components/common/SafeSvgHtml'
import { LogoSvg } from '../../components/common/LogoSvg'
import { CourtTitleSolo } from '@/components/court/CourtTitleSolo'
import { CourtZone } from '@/components/court/CourtZone'
import { ZoneBioCard } from '@/components/court/zones/ZoneBioCard'
import { ZoneCareerStats } from '@/components/court/zones/ZoneCareerStats'
import { ZoneProjects } from '@/components/court/zones/ZoneProjects'
import { ZoneEntryButton } from '@/components/common/ZoneEntryButton'

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
      bio: (
        <CourtZone x={350} y={110} width={380} height={160}>
          <div id="bio-card">
            <ZoneBioCard />
          </div>
        </CourtZone>
      ),
      'career-stats': (
        <CourtZone x={800} y={110} width={280} height={160}>
          <div id="career-stats-card">
            <ZoneCareerStats />
          </div>
        </CourtZone>
      ),
      logo: (
        <CourtZone x={610} y={355} width={300} height={300}>
          <LogoSvg />
        </CourtZone>
      ),
      scouting: (
        <CourtZone x={110} y={930} width={320} height={70}>
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
                    📫 Go to Front Office
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
        </CourtZone>
      ),
      'replay-intro': (
        <foreignObject x="1210" y="870" width="180" height="70">
          <ReplayIntroButton />
        </foreignObject>
      ),
      'court-title': (
        <foreignObject x="600" y="20" width="350" height="100">
          <CourtTitleSolo title="Welcome to the Court" />
        </foreignObject>
      ),
      'right-entry-zone': (
        <CourtZone x={1150} y={120} width={400} height={300} className="ui-layer z-[110]">
          <SafeSvgHtml>
            <div className="flex flex-col gap-3 items-center w-fit">
              <ZoneEntryButton
                icon="🏟️"
                label="View The Rafters"
                id="view-rafters"
                onClick={() => (window.location.href = '/banners')}
              />
              <ZoneEntryButton
                icon="🧳"
                label="Enter Locker Room"
                id="enter-locker-room"
                onClick={() => (window.location.href = '/locker-room')}
              />
              <ZoneEntryButton
                icon="🎨"
                label="View Project Binder"
                id="projects"
                onClick={() => (window.location.href = '/projects')}
              />
            </div>
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
                className="cursor-pointer px-4 py-1 text-sm sm:text-base font-semibold text-white bg-orange-600 rounded-full hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
              >
                →
              </button>
              <button
                onClick={() => {
                  stopTour()
                  markAsSeen()
                }}
                className="cursor-pointer px-4 py-1 text-sm sm:text-base font-semibold text-white bg-orange-600 rounded-full hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
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
