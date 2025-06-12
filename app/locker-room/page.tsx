'use client'

import React, { useState } from 'react'
import { LockerRoomSvg } from '@/components/locker-room/LockerRoomSvg'
import { DadJerseySVG } from '@/components/locker-room/DadJerseySvg'
import { LockerZone } from '@/components/locker-room/LockerZone'
import { LockerPlacardSVG } from '@/components/locker-room/LockerPlacardSvg'
import { InteractiveLockerItem } from '@/components/locker-room/InteractiveLockerItem'
import { QuestionJerseySVG } from '@/components/locker-room/QuestionJerseySvg'
import { ZoeSvg } from '@/components/locker-room/Zoe'
import { MythicalFiveTrophySvg } from '@/components/locker-room/MythicalFiveSvg'
import { BasketballSvg } from '@/components/locker-room/basketballSvg'
import { Melo2sSvg } from '@/components/locker-room/Melo2s'
import { WayOfWade10sSVG } from '@/components/locker-room/WayOfWade10sSvg'
import { Harden7sSVG } from '@/components/locker-room/Harden7sSvg'
import { HigherDivisionTrophySVG } from '@/components/locker-room/HigherDivisionTrophy'
import { PlayStation5SVG } from '@/components/locker-room/PlayStation5SVG'
import { PS5ControllerSVG } from '@/components/locker-room/PS5ControllerSVG'
import { DuffelBagSvg } from '@/components/locker-room/DuffelBagSvg'
import { HeadphonesSvg } from '@/components/locker-room/HeadphonesSvg'
import { PatentSvg } from '@/components/locker-room/PatentSvg'
import { StrawHatSvg } from '@/components/locker-room/StrawHatSvg'
import { JerseysSVG } from '@/components/locker-room/JerseysSvg'
import { LaptopSvg } from '@/components/locker-room/LaptopSvg'
import { ScoutingReportSvg } from '@/components/locker-room/ScoutingReportSvg'
import { BackToCourtButton } from '@/components/BackToCourtButton'
import { LockerInfo } from '@/components/locker-room/LockerInfo'

export default function LockerRoomPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null)

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4">
      <div className="relative w-full">
        <LockerRoomSvg
          zoneContent={{
            'zone-323': (
              <LockerZone
                x={400}
                y={10}
                width={850}
                height={200}
              >
                      <h1 className="text-3xl font-bold mb-4">Locker Room - Select an item to get more info</h1>

              </LockerZone>
            ),
            'zone-324': (
              <LockerZone
                x={1220}
                y={630}
                width={150}
                height={200}
                zoneId="zone-324"
                onClick={setSelectedZone}
              >
                <ScoutingReportSvg />
              </LockerZone>
            ),
            'zone-325': (
              <LockerZone
                x={980}
                y={130}
                width={150}
                height={150}
                zoneId="zone-325"
                onClick={setSelectedZone}
              >
                <LaptopSvg />
              </LockerZone>
            ),
            'zone-327': (
              <LockerZone
                x={58}
                y={285}
                width={340}
                height={370}
                zoneId="zone-327"
                onClick={setSelectedZone}
              >
                <JerseysSVG />
              </LockerZone>
            ),
            'zone-328': (
              <LockerZone
                x={430}
                y={150}
                width={160}
                height={200}
                zoneId="zone-328"
                onClick={setSelectedZone}
              >
                <StrawHatSvg />
              </LockerZone>
            ),
            'zone-330': (
              <LockerZone
                x={1180}
                y={120}
                width={250}
                height={200}
                zoneId="zone-330"
                onClick={setSelectedZone}
              >
                <DuffelBagSvg />
              </LockerZone>
            ),
            'zone-342': (
              <LockerZone
                x={630}
                y={250}
                width={300}
                height={370}
                zoneId="zone-342"
                onClick={setSelectedZone}
              >
                <DadJerseySVG />
              </LockerZone>
            ),
            'zone-355': (
              <LockerZone
                x={980}
                y={82}
                width={300}
                height={150}
                zoneId="zone-355"
                onClick={setSelectedZone}
              >
                <LockerPlacardSVG label="Canoga" />
              </LockerZone>
            ),
            'zone-356': (
              <LockerZone
                x={440}
                y={82}
                width={300}
                height={100}
                zoneId="zone-356"
                onClick={setSelectedZone}
              >
                <LockerPlacardSVG label="Personal" />
              </LockerZone>
            ),
            'zone-357': (
              <LockerZone
                x={150}
                y={82}
                width={300}
                height={370}
                zoneId="zone-357"
                onClick={setSelectedZone}
              >
                <LockerPlacardSVG label="Hoops" />
              </LockerZone>
            ),
            'zone-360': (
              <LockerZone
                x={710}
                y={82}
                width={300}
                height={370}
                zoneId="zone-360"
                onClick={setSelectedZone}
              >
                <LockerPlacardSVG label="Wild Card" />
              </LockerZone>
            ),
            'zone-363': (
              <LockerZone
                x={1250}
                y={82}
                width={300}
                height={100}
                zoneId="zone-363"
                onClick={setSelectedZone}
              >
                <LockerPlacardSVG label="Next Team" />
              </LockerZone>
            ),
            'zone-361': (
              <LockerZone
                x={1170}
                y={280}
                width={250}
                height={320}
                zoneId="zone-361"
                onClick={setSelectedZone}
              >
                <QuestionJerseySVG className="w-16 h-auto opacity-90 hover:opacity-100" />
              </LockerZone>
            ),
            'zone-441': (
              <LockerZone
                x={670}
                y={790}
                width={250}
                height={320}
                zoneId="zone-441"
                onClick={setSelectedZone}
              >
                <ZoeSvg />
              </LockerZone>
            ),
            'zone-358': (
              <LockerZone
                x={220}
                y={120}
                width={100}
                height={180}
                zoneId="zone-358"
                onClick={setSelectedZone}
              >
                <HigherDivisionTrophySVG />
              </LockerZone>
            ),
            'zone-344': (
              <LockerZone
                x={90}
                y={650}
                width={100}
                height={180}
                zoneId="zone-344"
                onClick={setSelectedZone}
              >
                <BasketballSvg />
              </LockerZone>
            ),
            'zone-397': (
              <LockerZone
                x={950}
                y={410}
                width={170}
                height={250}
                zoneId="zone-397"
                onClick={setSelectedZone}
              >
                <PatentSvg />
              </LockerZone>
            ),
            'zone-400': (
              <LockerZone
                x={510}
                y={670}
                width={100}
                height={100}
                zoneId="zone-400"
                onClick={setSelectedZone}
              >
                <InteractiveLockerItem>
                  <HeadphonesSvg />
                </InteractiveLockerItem>
              </LockerZone>
            ),
            'zone-437': (
              <LockerZone
                x={150}
                y={800}
                width={150}
                height={180}
                zoneId="zone-437"
                onClick={setSelectedZone}
              >
                <Melo2sSvg />
              </LockerZone>
            ),
            'zone-439': (
              <LockerZone
                x={440}
                y={800}
                width={160}
                height={190}
                zoneId="zone-439"
                onClick={setSelectedZone}
              >
                <WayOfWade10sSVG />
              </LockerZone>
            ),
            'zone-443': (
              <LockerZone
                x={960}
                y={820}
                width={160}
                height={190}
                zoneId="zone-443"
                onClick={setSelectedZone}
              >
                <Harden7sSVG />
              </LockerZone>
            ),
            'zone-376': (
              <LockerZone
                x={630}
                y={620}
                width={160}
                height={190}
                zoneId="zone-376"
                onClick={setSelectedZone}
              >
                <PlayStation5SVG />
              </LockerZone>
            ),
            'zone-378': (
              <LockerZone
                x={740}
                y={700}
                width={80}
                height={80}
                zoneId="zone-378"
                onClick={setSelectedZone}
              >
                <PS5ControllerSVG />
              </LockerZone>
            ),
            'zone-379': (
              <LockerZone
                x={820}
                y={700}
                width={80}
                height={80}
                zoneId="zone-379"
                onClick={setSelectedZone}
              >
                <PS5ControllerSVG />
              </LockerZone>
            ),
            'zone-99': (
              <foreignObject x="1220" y="970" width="340" height="70">
                <BackToCourtButton />
              </foreignObject>
            ),
            'zone-380': (
              <foreignObject x="670" y="150" width="220" height="140">
                {!!selectedZone && <LockerInfo zoneId={selectedZone} />}
              </foreignObject>
            ),
          }}
        />
      </div>
    </main>
  )
}
