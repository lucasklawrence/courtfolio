'use client'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { LogoSvg } from '@/components/common/LogoSvg'
import { CourtContainer } from '@/components/court/CourtContainer'
import { CourtSvg } from '@/components/court/CourtSvg'
import { CourtTitleSolo } from '@/components/court/CourtTitleSolo'
import { CourtZone } from '@/components/court/CourtZone'
import { ZoneBars } from '@/components/court/zones/ZoneBars'
import { ZoneBioCard } from '@/components/court/zones/ZoneBioCard'
import { ZoneCareerStats } from '@/components/court/zones/ZoneCareerStats'
import { ZoneFantasy } from '@/components/court/zones/ZoneFantasy'
import React from 'react'

export default function ProjectPage() {
  return (
    <CourtContainer>
      {/* 🏀 Court Background */}
      <CourtSvg
        zoneContent={{
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
          'zone-90': (
            <CourtZone x={350} y={700} width={360} height={140}>
              <ZoneBars />
            </CourtZone>
          ),
          'zone-91': (
            <CourtZone x={800} y={700} width={360} height={140}>
              <ZoneFantasy />
            </CourtZone>
          ),
          'zone-99': (
            <foreignObject x="1220" y="873" width="340" height="70">
              <BackToCourtButton />
            </foreignObject>
          ),
          // Court Title
          'zone-50': (
            <foreignObject x="600" y="20" width="350" height="100">
              <CourtTitleSolo title="Highlight Reel" />
            </foreignObject>
          ),
        }}
      />
    </CourtContainer>
  )
}
