'use client'

import { CourtSvg } from '@/components/CourtSvg'
import { motion } from 'framer-motion'
import { CourtTitle } from '@/components/CourtTitle'
import { BackToCourtButton } from '@/components/BackToCourtButton'
import React from 'react'
import { CourtContainer } from '@/components/CourtContainer'
import { CourtZone } from '@/components/CourtZone'
import { ZoneContact } from '@/components/ZoneContact'

export default function ContactPage() {
  return (
    <CourtContainer>
      {/* 🏀 Court Background */}
      <CourtSvg
        zoneContent={{
          'zone-80': (
            <CourtZone x={580} y={420} width={380} height={220}>
              <ZoneContact />
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
              <CourtTitle title="Lucas Lawrence" subtitle="Draft Board" />
            </foreignObject>
          ),
        }}
      />
    </CourtContainer>
  )
}
