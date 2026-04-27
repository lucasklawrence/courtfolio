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
import { TrainingFacilityCourtEntry } from '@/components/training-facility/TrainingFacilityCourtEntry'
import { isTrainingFacilityEnabled } from '@/lib/feature-flags'

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
  const trainingFacilityEnabled = isTrainingFacilityEnabled()

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
                  <span aria-hidden="true">🕵️</span> Scouting Area
                </div>
                <div className="flex gap-4 text-sm">
                  <button
                    onClick={() => router.push('/contact')}
                    aria-label="Front Office — contact form and inquiries"
                    className="cursor-pointer hover:text-orange-500 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 rounded-sm"
                  >
                    <span aria-hidden="true">📫</span> Go to Front Office
                  </button>
                  <button
                    onClick={() => window.open('/LucasLawrenceResume.pdf', '_blank')}
                    aria-label="Open resume PDF in a new tab"
                    className="cursor-pointer hover:text-orange-500 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 rounded-sm"
                  >
                    <span aria-hidden="true">📄</span> Resume
                  </button>
                </div>
              </div>
            </div>
          </SafeSvgHtml>
        </CourtZone>
      ),
      'principles-lineup': (
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
      'tech-stack-lineup': (
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
                ariaLabel="Rafters — career highlights and accolades"
                id="view-rafters"
                onClick={() => (window.location.href = '/banners')}
              />
              <ZoneEntryButton
                icon="🧳"
                label="Enter Locker Room"
                ariaLabel="Locker Room — about and interests"
                id="enter-locker-room"
                onClick={() => (window.location.href = '/locker-room')}
              />
              <ZoneEntryButton
                icon="🎨"
                label="View Project Binder"
                ariaLabel="Project Binder — selected work and case studies"
                id="projects"
                onClick={() => (window.location.href = '/projects')}
              />
            </div>
          </SafeSvgHtml>
        </CourtZone>
      ),
      ...(trainingFacilityEnabled
        ? {
            'training-facility-entry': (
              <CourtZone x={1115} y={680} width={180} height={160} className="ui-layer z-[105]">
                <SafeSvgHtml>
                  <TrainingFacilityCourtEntry
                    id="enter-training-facility"
                    onClick={() => router.push('/training-facility')}
                  />
                </SafeSvgHtml>
              </CourtZone>
            ),
          }
        : {}),
    }),
    [router, trainingFacilityEnabled]
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
                aria-label="Next tour step"
                className="cursor-pointer px-4 py-1 text-sm sm:text-base font-semibold text-white bg-orange-600 rounded-full hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 transition"
              >
                <span aria-hidden="true">→</span>
              </button>
              <button
                onClick={() => {
                  stopTour()
                  markAsSeen()
                }}
                aria-label="Skip the guided tour"
                className="cursor-pointer px-4 py-1 text-sm sm:text-base font-semibold text-white bg-orange-600 rounded-full hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 transition"
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
                aria-label="Replay the guided tour"
                className="px-3 py-1.5 text-xs sm:text-sm rounded-full bg-orange-600 text-white hover:bg-orange-500 transition shadow-sm whitespace-nowrap cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
              >
                <span aria-hidden="true">🔁</span> Replay Tour
              </button>
            )}
          </div>
        </SafeSvgHtml>
      </CourtZone>
    )
  }

  return zoneContent
}
