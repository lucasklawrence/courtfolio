'use client'

import { motion } from 'framer-motion'
import { SafeSvgHtml } from '@/components/SafeSvgHtml'

/**
 * Modern version of the Contact zone using backdrop blur and motion.
 */
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
        className="p-4 bg-orange-900/70 backdrop-blur-sm text-white drop-shadow-md rounded-md border border-orange-500/40 space-y-2"
      >
        <h3 className="text-lg font-bold text-center text-orange-300">📋 Scouting Inquiry</h3>
        <p className="text-xs text-center leading-snug text-white/90">
          Let’s connect — for dream teams, pick-up ideas, or just a chat.
        </p>
        <ul className="text-xs space-y-1 list-none pl-0">
          <li>
            <strong>Email:</strong>{' '}
            <a href="mailto:lucasklawrence@gmail.com" className="text-orange-300 underline hover:text-orange-200">
              lucasklawrence@gmail.com
            </a>
          </li>
          <li>
            <strong>LinkedIn:</strong>{' '}
            <a href="https://linkedin.com/in/lucasklawrence" target="_blank" className="text-orange-300 underline hover:text-orange-200">
              /lucasklawrence
            </a>
          </li>
          <li>
            <strong>Resume:</strong>{' '}
            <a href="/LucasLawrenceResume.pdf" target="_blank" className="text-orange-300 underline hover:text-orange-200">
              View PDF
            </a>
          </li>
        </ul>
      </motion.div>
    </SafeSvgHtml>
  )
}
