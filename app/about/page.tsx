'use client'

import { CourtSvg } from '@/components/CourtSvg'
import { CourtTitle } from '@/components/CourtTitle'
import { BackToCourtButton } from '@/components/BackToCourtButton'
import React from 'react'

export default function AboutPage() {
  return (
    <React.Fragment>
      <CourtSvg
        zoneContent={{
          // Player Bio Card
          'zone-106': (
            <foreignObject x="280" y="200" width="380" height="160">
              <div className="bg-orange-800/80 backdrop-blur-sm text-white p-4 rounded-lg border border-orange-400/30 shadow-sm animate-bounce-slow">
                <h2 className="text-lg font-bold text-center text-orange-300">Lucas Lawrence</h2>
                <p className="text-sm text-center mt-1">🏀 Senior Software Engineer & Technical Playmaker</p>
                <p className="text-xs mt-2 leading-snug text-white/90">
                  I build scalable systems, design clean APIs, and coach full-stack teams. From court vision to execution.
                </p>
              </div>
            </foreignObject>
          ),

          // Stats Overview
          'zone-107': (
            <foreignObject x="800" y="200" width="280" height="160">
              <div className="bg-orange-900/70 text-white p-4 rounded-lg border border-orange-400/30 shadow-sm space-y-1 text-xs">
                <h3 className="text-sm font-bold text-orange-300 text-center">📊 Career Stats</h3>
                <ul className="space-y-1">
                  <li><strong>Years on Court:</strong> 10+</li>
                  <li><strong>Patents:</strong> 1 (Low Latency Packet Sync)</li>
                  <li><strong>Roles:</strong> Senior Eng, Team Lead</li>
                  <li><strong>Specialties:</strong> Java, Spring, Kubernetes, DDD</li>
                </ul>
              </div>
            </foreignObject>
          ),
           'zone-99': (
  <foreignObject x="1150" y="850" width="300" height="70">
    <div className="flex items-center justify-center w-full h-full">
      <BackToCourtButton />
    </div>
  </foreignObject>
)

        }}
      />
      <CourtTitle
        title="Lucas Lawrence"
        subtitle="About the Player"
      />
      </React.Fragment>
  )
}
