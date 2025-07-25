'use client'

import React, { useState } from 'react'
import { LockerRoomSvg } from '@/components/locker-room/LockerRoomSvg'
import { DadJerseySVG } from '@/components/locker-room/assets/DadJerseySvg'
import { LockerZone } from '@/components/locker-room/LockerZone'
import { LockerPlacardSVG } from '@/components/locker-room/LockerPlacardSvg'
import { InteractiveLockerItem } from '@/components/locker-room/InteractiveLockerItem'
import { QuestionJerseySVG } from '@/components/locker-room/assets/QuestionJerseySvg'
import { ZoeSvg } from '@/components/locker-room/assets/Zoe'
import { BasketballSvg } from '@/components/locker-room/assets/basketballSvg'
import { Melo2sSvg } from '@/components/locker-room/assets/Melo2s'
import { WayOfWade10sSVG } from '@/components/locker-room/assets/WayOfWade10sSvg'
import { Harden7sSVG } from '@/components/locker-room/assets/Harden7sSvg'
import { HigherDivisionTrophySVG } from '@/components/locker-room/assets/HigherDivisionTrophy'
import { PlayStation5SVG } from '@/components/locker-room/assets/PlayStation5SVG'
import { PS5ControllerSVG } from '@/components/locker-room/assets/PS5ControllerSVG'
import { DuffelBagSvg } from '@/components/locker-room/assets/DuffelBagSvg'
import { HeadphonesSvg } from '@/components/locker-room/assets/HeadphonesSvg'
import { PatentSvg } from '@/components/locker-room/assets/PatentSvg'
import { StrawHatSvg } from '@/components/locker-room/assets/StrawHatSvg'
import { JerseysSVG } from '@/components/locker-room/assets/JerseysSvg'
import { LaptopSvg } from '@/components/locker-room/assets/LaptopSvg'
import { ScoutingReportSvg } from '@/components/locker-room/assets/ScoutingReportSvg'
import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { LockerInfo } from '@/components/locker-room/LockerInfo'
import { SvgLayoutContainer } from '@/components/common/SvgLayoutContainer'

/**
 * Renders the Locker Room page of the basketball-themed portfolio.
 *
 * This interactive page displays a stylized locker room using an SVG background,
 * with clickable zones representing different items (e.g., jerseys, shoes, devices).
 * Each zone shows contextual information or media when selected.
 *
 * Features:
 * - SVG-based layout with `LockerRoomSvg`
 * - Interactive zones rendered via `LockerZone` components
 * - Clickable items open metadata or illustrations in an overlay
 * - “Back to Court” button for navigation
 *
 * @returns {JSX.Element} The rendered Locker Room page
 */
export default function LockerRoomPage() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null)

  return (
    <SvgLayoutContainer>
      <LockerRoomSvg
        zoneContent={{
          title: (
            <LockerZone x={400} y={10} width={850} height={200}>
              <h1 className="text-3xl font-bold mb-4">
                Locker Room - Select an item to get more info
              </h1>
            </LockerZone>
          ),
          'scout-report': (
            <LockerZone
              x={1220}
              y={630}
              width={150}
              height={200}
              zoneId="scout-report"
              onClick={setSelectedZone}
            >
              <ScoutingReportSvg />
            </LockerZone>
          ),
          laptop: (
            <LockerZone
              x={980}
              y={130}
              width={150}
              height={250}
              zoneId="laptop"
              onClick={setSelectedZone}
            >
              <LaptopSvg />
            </LockerZone>
          ),
          jerseys: (
            <LockerZone
              x={58}
              y={285}
              width={340}
              height={370}
              zoneId="jerseys"
              onClick={setSelectedZone}
            >
              <JerseysSVG />
            </LockerZone>
          ),
          'straw-hat': (
            <LockerZone
              x={430}
              y={150}
              width={160}
              height={200}
              zoneId="straw-hat"
              onClick={setSelectedZone}
            >
              <StrawHatSvg />
            </LockerZone>
          ),
          'duffel-bag': (
            <LockerZone
              x={1180}
              y={120}
              width={250}
              height={200}
              zoneId="duffel-bag"
              onClick={setSelectedZone}
            >
              <DuffelBagSvg />
            </LockerZone>
          ),
          'dad-jersey': (
            <LockerZone
              x={630}
              y={250}
              width={300}
              height={370}
              zoneId="dad-jersey"
              onClick={setSelectedZone}
            >
              <DadJerseySVG />
            </LockerZone>
          ),
          'locker-placard-4': (
            <LockerZone
              x={980}
              y={82}
              width={300}
              height={50}
              zoneId="locker-placard-4"
              onClick={setSelectedZone}
            >
              <LockerPlacardSVG label="Canoga" />
            </LockerZone>
          ),
          'locker-placard-2': (
            <LockerZone
              x={440}
              y={82}
              width={300}
              height={100}
              zoneId="locker-placard-2"
              onClick={setSelectedZone}
            >
              <LockerPlacardSVG label="Personal" />
            </LockerZone>
          ),
          'locker-placard-1': (
            <LockerZone
              x={150}
              y={82}
              width={300}
              height={100}
              zoneId="locker-placard-1"
              onClick={setSelectedZone}
            >
              <LockerPlacardSVG label="Hoops" />
            </LockerZone>
          ),
          'locker-placard-3': (
            <LockerZone
              x={710}
              y={82}
              width={300}
              height={370}
              zoneId="locker-placard-3"
              onClick={setSelectedZone}
            >
              <LockerPlacardSVG label="Wild Card" />
            </LockerZone>
          ),
          'locker-placard-5': (
            <LockerZone
              x={1250}
              y={82}
              width={300}
              height={100}
              zoneId="locker-placard-5"
              onClick={setSelectedZone}
            >
              <LockerPlacardSVG label="Next Team" />
            </LockerZone>
          ),
          'question-jersey': (
            <LockerZone
              x={1170}
              y={280}
              width={250}
              height={320}
              zoneId="question-jersey"
              onClick={setSelectedZone}
            >
              <QuestionJerseySVG className="w-16 h-auto opacity-90 hover:opacity-100" />
            </LockerZone>
          ),
          zoe: (
            <LockerZone
              x={670}
              y={790}
              width={250}
              height={320}
              zoneId="zoe"
              onClick={setSelectedZone}
            >
              <ZoeSvg />
            </LockerZone>
          ),
          'higher-division-trophy': (
            <LockerZone
              x={220}
              y={120}
              width={100}
              height={180}
              zoneId="higher-division-trophy"
              onClick={setSelectedZone}
            >
              <HigherDivisionTrophySVG />
            </LockerZone>
          ),
          basketball: (
            <LockerZone
              x={90}
              y={650}
              width={100}
              height={180}
              zoneId="basketball"
              onClick={setSelectedZone}
            >
              <BasketballSvg />
            </LockerZone>
          ),
          patent: (
            <LockerZone
              x={950}
              y={410}
              width={170}
              height={250}
              zoneId="patent"
              onClick={setSelectedZone}
            >
              <PatentSvg />
            </LockerZone>
          ),
          headphones: (
            <LockerZone
              x={510}
              y={670}
              width={100}
              height={100}
              zoneId="headphones"
              onClick={setSelectedZone}
            >
              <HeadphonesSvg />
            </LockerZone>
          ),
          'melo-2': (
            <LockerZone
              x={150}
              y={800}
              width={150}
              height={180}
              zoneId="melo-2"
              onClick={setSelectedZone}
            >
              <Melo2sSvg />
            </LockerZone>
          ),
          'way-of-wade-10': (
            <LockerZone
              x={440}
              y={800}
              width={160}
              height={190}
              zoneId="way-of-wade-10"
              onClick={setSelectedZone}
            >
              <WayOfWade10sSVG />
            </LockerZone>
          ),
          'harden-7': (
            <LockerZone
              x={960}
              y={820}
              width={160}
              height={190}
              zoneId="harden-7"
              onClick={setSelectedZone}
            >
              <Harden7sSVG />
            </LockerZone>
          ),
          ps5: (
            <LockerZone
              x={630}
              y={620}
              width={160}
              height={190}
              zoneId="ps5"
              onClick={setSelectedZone}
            >
              <PlayStation5SVG />
            </LockerZone>
          ),
          'ps5-controller-1': (
            <LockerZone
              x={740}
              y={700}
              width={80}
              height={80}
              zoneId="ps5-controller-1"
              onClick={setSelectedZone}
            >
              <PS5ControllerSVG />
            </LockerZone>
          ),
          'ps5-controller-2': (
            <LockerZone
              x={820}
              y={700}
              width={80}
              height={80}
              zoneId="ps5-controller-2"
              onClick={setSelectedZone}
            >
              <PS5ControllerSVG />
            </LockerZone>
          ),
          'back-to-court': (
            <LockerZone x={1220} y={970} width={340} height={70}>
              <BackToCourtButton />
            </LockerZone>
          ),
          'locker-info': (
            <LockerZone x={670} y={150} width={220} height={140}>
              {!!selectedZone && <LockerInfo zoneId={selectedZone} />}
            </LockerZone>
          ),
        }}
      />
    </SvgLayoutContainer>
  )
}
