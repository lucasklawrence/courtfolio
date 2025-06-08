'use client'

import { CourtSvg } from '@/components/CourtSvg'
import { motion } from 'framer-motion'
import { CourtTitle } from '@/components/CourtTitle'
import { BackToCourtButton } from '@/components/BackToCourtButton'
import React from 'react'
import { CourtContainer } from '@/components/CourtContainer'

export default function ContactPage() {
  return (
    <CourtContainer>
      {/* 🏀 Court Background */}
      <CourtSvg
        zoneContent={{
          'zone-80': (
            <foreignObject x="580" y="420" width="380" height="220">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 120,
                  damping: 12,
                  delay: 0.2,
                }}
                className="p-4 bg-orange-900/70 backdrop-blur-sm text-white drop-shadow-md rounded-md border border-orange-500/40 space-y-2"
              >
                <h3 className="text-lg font-bold text-center text-orange-300">
                  📋 Scouting Inquiry
                </h3>
                <p className="text-xs text-center leading-snug text-white/90">
                  Let’s connect — for dream teams, pick-up ideas, or just a chat.
                </p>
                <ul className="text-xs space-y-1 list-none pl-0">
                  <li>
                    <strong>Email:</strong>{' '}
                    <a
                      href="mailto:lucasklawrence@gmail.com"
                      className="text-orange-300 underline hover:text-orange-200"
                    >
                      lucasklawrence@gmail.com
                    </a>
                  </li>
                  <li>
                    <strong>LinkedIn:</strong>{' '}
                    <a
                      href="https://linkedin.com/in/lucasklawrence"
                      target="_blank"
                      className="text-orange-300 underline hover:text-orange-200"
                    >
                      /lucasklawrence
                    </a>
                  </li>
                  <li>
                    <strong>Resume:</strong>{' '}
                    <a
                      href="/LucasLawrenceResume.pdf"
                      target="_blank"
                      className="text-orange-300 underline hover:text-orange-200"
                    >
                      View PDF
                    </a>
                  </li>
                </ul>
              </motion.div>
            </foreignObject>
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
