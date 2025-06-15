'use client'

import { BackToCourtButton } from '@/components/BackToCourtButton'
import React from 'react'
import { CourtZone } from '@/components/CourtZone'
import { ZoneContact } from '@/components/ZoneContact'
import { CourtTitleSolo } from '@/components/CourtTitleSolo'
import { FrontOfficeSvg } from '@/components/contact/FrontOfficeSvg'
import { SafeSvgHtml } from '@/components/SafeSvgHtml'
import { LogoSvg } from '@/components/LogoSvg'
import { QuestionJerseySVG } from '@/components/locker-room/QuestionJerseySvg'
import { LucasJerseySvg } from '@/components/contact/LucasJerseySvg'
import { LosAngelesPictureSvg } from '@/components/contact/LosAngelesPictureSvg'
import { FrontOfficeZone } from '@/components/contact/FrontOfficeZone'

export default function ContactPage() {
  return (
    <main className="h-screen w-screen bg-neutral-900 text-white flex items-center justify-center overflow-hidden">
      <FrontOfficeSvg
        className="h-full w-auto max-w-none"
        zoneContent={{
          'zone-80': (
            <CourtZone x={450} y={100} width={650} height={300}>
              <ZoneContact />
            </CourtZone>
          ),
          'zone-99': (
            <foreignObject x="1320" y="980" width="340" height="70">
              <BackToCourtButton />
            </foreignObject>
          ),
          'zone-81': (
            <foreignObject x="550" y="620" width="350" height="100">
              <div className="w-full h-full flex flex-col justify-center items-center">
                <a
                  href="/LucasLawrenceResume.pdf"
                  target="_blank"
                  className="text-sm text-black font-semibold underline hover:text-blue-700"
                  style={{
                    fontFamily: 'serif',
                    backgroundColor: 'transparent',
                  }}
                >
                  View Full Resume (PDF)
                </a>
              </div>
            </foreignObject>
          ),
          'zone-82': (
            <foreignObject x="645" y="735" width="350" height="40">
              <foreignObject x="645" y="835" width="350" height="40">
                <div
                  className="w-full h-full flex flex-col justify-end items-start"
                  style={{
                    fontFamily: '"Patrick Hand", cursive',
                    fontSize: '14px',
                    color: '#333',
                  }}
                >
                  <span>x </span>
                  <div
                    style={{
                      width: '160px',
                      borderBottom: '1px solid #444',
                      marginTop: '2px',
                    }}
                  />
                </div>
              </foreignObject>
            </foreignObject>
          ),
          'zone-83': (
            <FrontOfficeZone x={1210} y={110} width={150} height={250}>
              <LucasJerseySvg />
            </FrontOfficeZone>
          ),
          'zone-84': (
            <FrontOfficeZone x={169} y={128} width={173} height={180}>
              <LosAngelesPictureSvg />
            </FrontOfficeZone>
          ),
        }}
      />
    </main>
  )
}
