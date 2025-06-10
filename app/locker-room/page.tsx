'use client'

import React from 'react'
import { LockerRoomSvg } from '@/components/locker-room/LockerRoomSvg'
import { DadJerseySVG } from '@/components/locker-room/DadJerseySvg'
import { LockerZone } from '@/components/locker-room/LockerZone'
import { LockerPlacardSVG } from '@/components/locker-room/LockerPlacardSvg'

export default function LockerRoomPage() {
  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">🏀 Locker Room</h1>
      <p className="mb-8 text-sm text-gray-300">Click a locker to view its contents</p>

      <div className="w-full max-w-6xl">
        <LockerRoomSvg
          onZoneClick={zoneId => console.log(zoneId)}
          zoneContent={{
            'zone-342': (
              <LockerZone x={630} y={250} width={300} height={370}>
                <DadJerseySVG />
              </LockerZone>
            ),
            'zone-360': (
              <LockerZone x={710} y={80} width={300} height={370}>
                <LockerPlacardSVG label="Wild Card" />
              </LockerZone>
            ),
          }}
        />
      </div>
    </main>
  )
}
