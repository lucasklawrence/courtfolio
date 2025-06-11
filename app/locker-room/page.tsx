'use client'

import React from 'react'
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
import { VinylSvg } from '@/components/locker-room/VinylSvg'
import { HeadphonesSvg } from '@/components/locker-room/HeadphonesSvg'
import { PatentSvg } from '@/components/locker-room/PatentSvg'
import { ScoutsCapeSvg } from '@/components/locker-room/ScoutsCapeSvg'
import { StrawHatSvg } from '@/components/locker-room/StrawHatSvg'
import { JerseysSVG } from '@/components/locker-room/JerseysSvg'
import { LaptopSvg } from '@/components/locker-room/LaptopSvg'
import { BooksSvg } from '@/components/locker-room/BooksSvg'
import { ScoutingReportSvg } from '@/components/locker-room/ScoutingReportSvg'
import { BackToCourtButton } from '@/components/BackToCourtButton'

export default function LockerRoomPage() {
  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">🏀 Locker Room</h1>

      <div className="w-full max-w-6xl">
        <LockerRoomSvg
          onZoneClick={zoneId => console.log(zoneId)}
          zoneContent={{

            'zone-324': (
              <LockerZone x={1220} y={630} width={150} height={200}>
                  <ScoutingReportSvg />
              </LockerZone>
            ),
            'zone-325': (
              <LockerZone x={980} y={620} width={150} height={150}>
                  <LaptopSvg />
              </LockerZone>
            ),
            'zone-326': (
              <LockerZone x={980} y={130} width={150} height={150}>
                  <BooksSvg />
              </LockerZone>
            ),
            'zone-327': (
              <LockerZone x={58} y={285} width={340} height={370}>
                  <JerseysSVG />
              </LockerZone>
            ),
            'zone-328': (
              <LockerZone x={430} y={150} width={160} height={200}>
                  <StrawHatSvg />
              </LockerZone>
            ),
            'zone-329': (
              <LockerZone x={380} y={350} width={260} height={400}>
                  <ScoutsCapeSvg />
              </LockerZone>
            ),
            'zone-330': (
              <LockerZone x={1180} y={120} width={250} height={200}>
                <InteractiveLockerItem>
                  <DuffelBagSvg />
                </InteractiveLockerItem>
              </LockerZone>
            ),
            'zone-342': (
              <LockerZone x={630} y={250} width={300} height={370}>
                <InteractiveLockerItem>
                  <DadJerseySVG />
                </InteractiveLockerItem>
              </LockerZone>
            ),
            'zone-355': (
              <LockerZone x={980} y={82} width={300} height={370}>
                <LockerPlacardSVG label="Canoga" />
              </LockerZone>
            ),
             'zone-356': (
              <LockerZone x={440} y={82} width={300} height={370}>
                <LockerPlacardSVG label="Personal" />
              </LockerZone>
            ),
             'zone-357': (
              <LockerZone x={150} y={82} width={300} height={370}>
                <LockerPlacardSVG label="Hoops" />
              </LockerZone>
            ),
            'zone-360': (
              <LockerZone x={710} y={82} width={300} height={370}>
                <LockerPlacardSVG label="Wild Card" />
              </LockerZone>
            ),
            'zone-363': (
              <LockerZone x={1250} y={82} width={300} height={370}>
                <LockerPlacardSVG label="Next Team" />
              </LockerZone>
            ),
            'zone-361': (
              <LockerZone x={1170} y={280} width={250} height={320}>
                <InteractiveLockerItem>
                  <QuestionJerseySVG className="w-16 h-auto opacity-90 hover:opacity-100" />
                </InteractiveLockerItem>
              </LockerZone>
            ),
            'zone-441': (
              <LockerZone x={670} y={790} width={250} height={320}>
                <ZoeSvg />
              </LockerZone>
            ),
            'zone-359': (
              <LockerZone x={90} y={130} width={100} height={180}>
                <MythicalFiveTrophySvg />
              </LockerZone>
            ),
            'zone-358': (
              <LockerZone x={220} y={120} width={100} height={180}>
                <HigherDivisionTrophySVG />
              </LockerZone>
            ),
            'zone-344': (
              <LockerZone x={90} y={650} width={100} height={180}>
                <BasketballSvg />
              </LockerZone>
            ),
             'zone-397': (
              <LockerZone x={950} y={410} width={170} height={250}>
                <PatentSvg />
              </LockerZone>
            ),
            'zone-399': (
              <LockerZone x={420} y={660} width={100} height={180}>
                <VinylSvg />
              </LockerZone>
            ),
            'zone-400': (
              <LockerZone x={510} y={670} width={100} height={100}>
                <InteractiveLockerItem>
                  <HeadphonesSvg />
                </InteractiveLockerItem>
              </LockerZone>
            ),
            'zone-437': (
              <LockerZone x={150} y={800} width={150} height={180}>
                <Melo2sSvg />
              </LockerZone>
            ),
            'zone-439': (
              <LockerZone x={440} y={800} width={160} height={190}>
                <WayOfWade10sSVG />
              </LockerZone>
            ),
            'zone-443': (
              <LockerZone x={960} y={820} width={160} height={190}>
                <Harden7sSVG />
              </LockerZone>
            ),
            'zone-376': (
              <LockerZone x={630} y={620} width={160} height={190}>
                <PlayStation5SVG />
              </LockerZone>
            ),
            'zone-378': (
              <LockerZone x={740} y={700} width={80} height={80}>
                <PS5ControllerSVG />
              </LockerZone>
            ),
            'zone-379': (
              <LockerZone x={820} y={700} width={80} height={80}>
                <PS5ControllerSVG />
              </LockerZone>
            ),
            /*'zone-445': (
                <LockerZone  x={1200} y={800} width={160} height={190}>
                    <KobesSVG/>
                </LockerZone>
            )*/
               'zone-99': (
                       <foreignObject x="1220" y="970" width="340" height="70">
                         <BackToCourtButton />
                       </foreignObject>
                     )
          }}
        />
      </div>
    </main>
  )
}
