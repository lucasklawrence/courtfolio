'use client'

import { motion } from 'framer-motion'

export interface LineupCardProps {
  name: string
  position: string
  jersey: number
  strengths: string[]
  award: string
}

const awardDescriptions: Record<string, string> = {
  MVP: 'Most Valuable Principle — always in play.',
  'All-Star': 'Consistent performer across projects.',
  'Clutch Performer': 'Shines under pressure.',
  'Sixth Man': 'Reliable support when needed most.',
  'Defensive POY': 'Protects against bugs + tech debt.',
}

export function LineupCard({ name, position, jersey, strengths, award }: LineupCardProps) {
  return (
    <motion.div
      className="rounded-2xl border border-neutral-300 bg-white p-4 shadow-md relative hover:shadow-lg transition-all"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.4 }}
    >
      <div className="absolute top-3 right-4 text-xl font-bold text-orange-500">#{jersey}</div>
      <h3 className="text-xl font-bold">{name}</h3>
      <p className="italic text-sm text-neutral-500">{position}</p>
      <ul className="mt-2 text-sm list-disc list-inside text-neutral-700">
        {strengths.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      <div
        className="mt-4 inline-block rounded-md bg-black text-white text-xs px-3 py-1"
        title={awardDescriptions[award]}
      >
        {award}
      </div>
    </motion.div>
  )
}
