'use client'

import { CourtSvg } from '@/components/CourtSvg'
import { CourtTitle } from '@/components/CourtTitle'
import { BackToCourtButton } from '@/components/BackToCourtButton'
import React from 'react'
import { CourtContainer } from '@/components/CourtContainer'
import { CourtZone } from '@/components/CourtZone'
import { ZoneFantasy } from '@/components/ZoneFantasy'
import { ZoneBars } from '@/components/ZoneBars'
import { ZoneFantasySafari } from '@/components/ZoneFantasySafari'

export default function ProjectPage() {
  return (
    <CourtContainer>
      {/* 🏀 Court Background */}
      <CourtSvg
        zoneContent={{
          'zone-90': (
            <CourtZone x={280} y={200} width={360} height={140}>
              <ZoneBars />
            </CourtZone>
          ),
          'zone-91': (
            <CourtZone x={880} y={200} width={360} height={140}>
              <ZoneFantasySafari />
            </CourtZone>
          ),
          'zone-99': (
            <foreignObject x="1150" y="850" width="300" height="70">
              <div className="flex items-center justify-center w-full h-full">
                <BackToCourtButton />
              </div>
            </foreignObject>
          ),
          // Court Title
          'zone-50': (
            <foreignObject x="600" y="0" width="350" height="100">
              <CourtTitle title="Lucas Lawrence" subtitle="Highlight Reel" />
            </foreignObject>
          ),
        }}
      />
    </CourtContainer>
  )
}
