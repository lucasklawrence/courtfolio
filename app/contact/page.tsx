'use client'

import { CourtSvg } from '@/components/CourtSvg'
import { BackToCourtButton } from '@/components/BackToCourtButton'
import React from 'react'
import { CourtContainer } from '@/components/CourtContainer'
import { CourtZone } from '@/components/CourtZone'
import { ZoneContact } from '@/components/ZoneContact'
import { ZoneCareerStats } from '@/components/ZoneCareerStats'
import { ZoneBioCard } from '@/components/ZoneBioCard'
import { LogoSvg } from '@/components/LogoSvg'
import { CourtTitleSolo } from '@/components/CourtTitleSolo'

export default function ContactPage() {
  return (
    <CourtContainer>
      {/* 🏀 Court Background */}
      <CourtSvg
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
          'zone-80': (
            <CourtZone x={350} y={720} width={380} height={220}>
              <ZoneContact />
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
              <CourtTitleSolo title="Draft Board" />
            </foreignObject>
          ),
        }}
      />
    </CourtContainer>
  )
}
