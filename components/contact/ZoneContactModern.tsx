'use client'

import { motion } from 'framer-motion'
import { SafeSvgHtml } from '@/components/SafeSvgHtml'

export function ZoneContactModern() {
  return (
    <SafeSvgHtml>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: 'spring',
          stiffness: 120,
          damping: 12,
          delay: 0.2,
        }}
        className="text-gray-900 text-xs leading-snug font-sans p-2"
      >
        <div className="flex gap-6">
          {/* Main left side */}
          <div className="flex-1 space-y-3">
            <div className="text-center">
              <h3 className="text-orange-500 text-base font-bold">Scouting Inquiry</h3>
              <p className="text-xs text-gray-800">
                Let’s connect — for dream teams, pick-up ideas, or just a chat.
              </p>
            </div>

            <ul className="text-left space-y-1">
              <li>
                <strong>Email:</strong>{' '}
                <a href="mailto:lucasklawrence@gmail.com" className="underline text-blue-700">
                  lucasklawrence@gmail.com
                </a>
              </li>
              <li>
                <strong>LinkedIn:</strong>{' '}
                <a
                  href="https://linkedin.com/in/lucasklawrence"
                  target="_blank"
                  className="underline text-blue-700"
                >
                  /lucasklawrence
                </a>
              </li>
            </ul>

            <div>
              <h4 className="font-bold text-orange-400">Scouting Report</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li>Position: Full-Stack Playmaker</li>
                <li>Strengths: React handles, Java core, court vision in architecture</li>
                <li>Court IQ: High – reads legacy systems, system player</li>
                <li>Leadership: Floor general who lifts the squad</li>
              </ul>
            </div>
          </div>

          {/* Right side column */}
          <div className="w-[45%] space-y-3">
            <div>
              <h4 className="font-bold text-orange-400">Season Highlights</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li>Architected cloud-native NMS</li>
                <li> Led secure microservice migration</li>
              </ul>
            </div>

            <div className="mt-3">
              <h4 className="font-bold text-orange-400">Shot Range</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li>🟢 React & Next.js — deep range</li>
                <li>🟢 Spring Boot — automatic in the lane</li>
                <li>🟡 Kafka & gRPC — confident midrange</li>
                <li>🔵 SVG & D3 — crafty finishes</li>
              </ul>
            </div>

            <div className="mt-3">
              <h4 className="font-bold text-orange-400">Free Agent Notes</h4>
              <ul className="list-disc ml-5 space-y-1">
                <li>Open to dream teams with creativity + scale</li>
                <li>Values joyful tooling and clean systems</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="text-center text-[10px] text-gray-500 mt-10 italic">
          "Plays drawn in code. Championships built in commits."
        </div>
      </motion.div>
    </SafeSvgHtml>
  )
}
