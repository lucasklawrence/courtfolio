'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import clsx from 'clsx'
import { FoilShineOverlay } from './FoilShineOverlay'
import { RarityBadge } from './RarityBadge'
import { StatusOverlay } from './StatusOverlay'
import { LegacyRibbon } from './LegacyRibbon'
/**
 * Props for the `TradeCard` component.
 *
 * Used to visually showcase a project as a collectible card in the binder view.
 * Cards include a project thumbnail, metadata, stack, and optional status or rarity effects.
 */
export type TradeCardProps = {
  /** Project title displayed prominently on the card */
  name: string

  /** Slug identifier used for internal routing or references */
  slug: string

  /** Short one-line hook or description of the project */
  tagline: string

  /** URL to the project’s thumbnail image (ideally 16:9 ratio) */
  thumbnailUrl: string

  /** Technologies used in the project (e.g., ['Next.js', 'Tailwind CSS']) */
  stack: string[]

  /** Brief statement on the project’s impact or result */
  impact: string

  /** Year the project was built or launched */
  year: number

  /** Highlight moment or notable aspect of the project */
  moment: string

  /** If true, adds gold foil and a featured badge */
  featured?: boolean

  /** If true, adds a purple glow and experimental badge */
  experimental?: boolean

  /** Optional status ribbon displayed at the top of the card */
  status?: 'coming-soon' | 'in-progress'

  /** Optional link to view the project (internal or external) */
  href?: string

  /** If true, shows a legacy ribbon */
legacy?: boolean
}



/**
 * Renders a stylized project card used in the portfolio binder layout.
 *
 * Cards resemble collectible trading cards and highlight key metadata:
 * - Project name, stack, impact, and highlight moment
 * - Optional rarity badges (featured, experimental)
 * - Optional status ribbon (e.g., "Coming Soon")
 * - Optional hover effects: y-offset and shadow
 *
 * Thumbnail is rendered using `next/image`, with optional foil overlay and metadata below.
 *
 * @component
 * @param {TradeCardProps} props - Project metadata and visual config
 * @returns {JSX.Element} An animated, styled card component
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
  legacy = false
}) => {
  const rarityClass = featured
    ? 'border-yellow-400'
    : experimental
    ? 'border-purple-500'
    : 'border-neutral-700'

  return (
    <motion.div
      whileHover={{
        y: -4,
        boxShadow: '0 0 16px rgba(255, 255, 255, 0.2)',
      }}
      transition={{ type: 'tween', duration: 0.3 }}
      className={clsx(
        'relative rounded-xl border p-4 bg-neutral-900 text-white w-full max-w-xs flex flex-col items-center transition-all overflow-hidden',
        rarityClass
      )}
    >
      {featured && <FoilShineOverlay />}
      {legacy && <LegacyRibbon />}

      <div className="w-full aspect-video relative rounded-md overflow-hidden border border-neutral-600 bg-black">
        <Image src={thumbnailUrl} alt={name} fill className="object-cover" />
      </div>

      <h3 className="mt-4 text-lg font-bold text-center leading-tight">{name}</h3>
      <p className="text-sm text-neutral-400 italic text-center">{tagline}</p>

      <div className="mt-2 text-xs text-yellow-200 space-y-1 text-center">
        <div>{impact}</div>
        <div>
          📅 {year} · ⚙️ {stack.join(', ')}
        </div>
        <div className="text-yellow-100 text-xs">{moment}</div>
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