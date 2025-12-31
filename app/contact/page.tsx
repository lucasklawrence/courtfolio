import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { FrontOfficeSvg } from '@/components/contact/FrontOfficeSvg'
import { FrontOfficeZone } from '@/components/contact/FrontOfficeZone'
import { LosAngelesPictureSvg } from '@/components/contact/LosAngelesPictureSvg'
import { LucasJerseySvg } from '@/components/contact/LucasJerseySvg'
import { ZoneContact } from '@/components/contact/ZoneContact'
import { SvgLayoutContainer } from '@/components/common/SvgLayoutContainer'
import React from 'react'

/**
 * Renders the Contact page, themed as a Front Office in the basketball portfolio.
 *
 * This SVG-based layout uses the `FrontOfficeSvg` background and interactive zones to
 * showcase contact info, location imagery, and a downloadable resume.
 *
 * Features:
 * - `ZoneContact` form embedded in a stylized court zone
 * - Clickable jersey and location images via `FrontOfficeZone`
 * - Resume link in a `foreignObject`
 * - Back to Court navigation button
 *
 * @returns {JSX.Element} The rendered ContactPage component
 */
export default function ContactPage() {
  return (
    <SvgLayoutContainer>
      <FrontOfficeSvg
        zoneContent={{
          whiteboard: (
            <FrontOfficeZone x={450} y={100} width={650} height={300}>
              <ZoneContact />
            </FrontOfficeZone>
          ),
          'back-to-court': (
            <FrontOfficeZone x={1320} y={980} width={340} height={70}>
              <BackToCourtButton />
            </FrontOfficeZone>
          ),
          resume: (
            <FrontOfficeZone x={550} y={620} width={350} height={100}>
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
            </FrontOfficeZone>
          ),
          'sign-here': (
            <FrontOfficeZone x={645} y={735} width={350} height={40}>
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
            </FrontOfficeZone>
          ),
          'right-frame': (
            <FrontOfficeZone x={1210} y={110} width={150} height={250}>
              <LucasJerseySvg />
            </FrontOfficeZone>
          ),
          'left-frame': (
            <FrontOfficeZone x={169} y={128} width={173} height={180}>
              <LosAngelesPictureSvg />
            </FrontOfficeZone>
          ),
        }}
      />
    </SvgLayoutContainer>
  )
}
