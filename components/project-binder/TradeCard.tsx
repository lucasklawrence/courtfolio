'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import clsx from 'clsx'
import { FoilShineOverlay } from './FoilShineOverlay'
import { RarityBadge } from './RarityBadge'
import { StatusOverlay } from './StatusOverlay'

/**
 * Props for the `TradeCard` component, which renders a stylized project card
 * similar to a collectible trading card.
 *
 * Used to showcase a project in the portfolio binder view with flair effects,
 * project metadata, and optional deep link support.
 */
export type TradeCardProps = {
  /** Project title displayed prominently on the card */
  name: string

  /** Slug identifier (used for internal routing or references) */
  slug: string

  /** Short one-line hook or description of the project */
  tagline: string

  /** URL to the project’s thumbnail image (ideally 16:9 ratio) */
  thumbnailUrl: string

  /** Technologies used in the project (e.g. ['Next.js', 'Tailwind']) */
  stack: string[]

  /** Brief statement on the project’s impact or outcome */
  impact: string

  /** Year the project was created or launched */
  year: number

  /** Highlight moment or unique trait of the project */
  moment: string

  /** Adds a special border and foil shine effect if true */
  featured?: boolean

  /** Adds a purple glow and experimental badge if true */
  experimental?: boolean

  /** Optional development status badge with shine overlay */
  status?: 'coming-soon' | 'in-progress'

  /** Optional external or internal URL — shown as a "View Project" link */
  href?: string
}

/**
 * Renders a single project as a stylized trading card, used in the project binder view.
 *
 * The card visually communicates project metadata (title, stack, impact, year),
 * and conditionally applies rare "foil" effects, status overlays, or experimental highlights.
 *
 * Key features:
 * - Framer Motion hover animation
 * - Optional rarity effects: featured (gold), experimental (purple)
 * - Optional status overlays: "Coming Soon", "In Progress"
 * - Thumbnail image + tech stack + moment of note
 * - Optional "View Project" external link rendered inside the card body
 *
 * @component
 * @param {TradeCardProps} props - Project metadata and display configuration
 * @returns {JSX.Element} A fully styled interactive project card component
 */
export const TradeCard: React.FC<TradeCardProps> = ({
  name,
  slug,
  tagline,
  thumbnailUrl,
  stack,
  impact,
  year,
  moment,
  featured = false,
  experimental = false,
  status,
  href,
}) => {
  const rarityClass = featured
    ? 'border-yellow-400 shadow-[0_0_20px_4px_rgba(255,255,0,0.4)]'
    : experimental
      ? 'border-purple-500 shadow-[0_0_10px_3px_rgba(180,0,255,0.3)]'
      : 'border-neutral-700'

  return (
    <motion.div
      whileHover={{ scale: 1.05, rotate: -1 }}
      className={clsx(
        'relative rounded-xl border p-4 bg-neutral-900 text-white w-full max-w-xs flex flex-col items-center transition-all overflow-hidden',
        rarityClass
      )}
    >
      {featured && <FoilShineOverlay />}

      <div className="w-full aspect-video relative rounded-md overflow-hidden border border-neutral-600 bg-black">
        <Image src={thumbnailUrl} alt={name} fill className="object-cover" />{' '}
      </div>

      <h3 className="mt-4 text-lg font-bold text-center leading-tight">{name}</h3>
      <p className="text-sm text-neutral-400 italic text-center">{tagline}</p>

      <div className="mt-2 text-xs text-yellow-200 space-y-1 text-center">
        <div>🏆 {impact}</div>
        <div>
          📅 {year} · ⚙️ {stack.join(', ')}
        </div>
        <div className="text-yellow-100 text-xs">🔥 {moment}</div>
      </div>

      <RarityBadge featured={featured} experimental={experimental} />

      {status && <StatusOverlay status={status} />}

      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-xs text-yellow-300 underline hover:text-yellow-100 transition"
        >
          View Project
        </a>
      )}
    </motion.div>
  )
}
