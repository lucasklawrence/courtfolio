'use client'

import { LineupCard, LineupCardProps } from './LineUpCard'

const lineup: LineupCardProps[] = [
  {
    name: 'Clean Code',
    position: 'Point Guard',
    jersey: 7,
    strengths: ['Readable and expressive', 'Minimizes long-term bugs', 'Eases collaboration'],
    award: 'MVP',
  },
  {
    name: 'Separation of Concerns',
    position: 'Shooting Guard',
    jersey: 24,
    strengths: ['Layered structure', 'Simplifies debugging', 'Reduces merge conflicts'],
    award: 'All-Star',
  },
  {
    name: 'Scalability',
    position: 'Small Forward',
    jersey: 11,
    strengths: ['Built to grow', 'Performance conscious', 'Low tech debt'],
    award: 'Clutch Performer',
  },
  {
    name: 'Test Coverage',
    position: 'Power Forward',
    jersey: 13,
    strengths: ['Catches regressions', 'Supports CI/CD', 'Boosts confidence'],
    award: 'Sixth Man',
  },
  {
    name: 'Consistent Architecture',
    position: 'Center',
    jersey: 35,
    strengths: ['Predictable patterns', 'New dev friendly', 'Reduces mental load'],
    award: 'Defensive POY',
  },
]

export function Lineup() {
  return (
    <section className="p-6">
      <h2 className="text-3xl font-bold mb-4 text-center">Starting 5 Principles</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {lineup.map(player => (
          <LineupCard key={player.name} {...player} />
        ))}
      </div>
    </section>
  )
}
