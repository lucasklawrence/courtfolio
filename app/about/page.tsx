'use client'

import { CourtSvg } from '@/components/CourtSvg'
import { CourtTitle } from '@/components/CourtTitle'
import { BackToCourtButton } from '@/components/BackToCourtButton'
import { CourtContainer } from '@/components/CourtContainer'
import React from 'react'
import { ZoneBioCard } from '@/components/ZoneBioCard'
import { CourtZone } from '@/components/CourtZone'
import { ZoneCareerStats } from '@/components/ZoneCareerStats'

export default function AboutPage() {
  return (
    <CourtContainer>
      <CourtSvg
        zoneContent={{
          // Player Bio Card
          'zone-106': (
            <CourtZone x={280} y={200} width={380} height={160}>
              <ZoneBioCard />
            </CourtZone>
          ),

          // Stats Overview
          'zone-107': (
            <CourtZone x={800} y={200} width={280} height={160}>
              <ZoneCareerStats />
            </CourtZone>
          ),

          // Back Button
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
              <CourtTitle title="Lucas Lawrence" subtitle="About the Player" />
            </foreignObject>
          ),
        }}
      />
    </CourtContainer>
  )
}
