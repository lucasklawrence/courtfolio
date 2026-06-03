'use client'

import { m, useReducedMotion } from 'framer-motion'
import Image from 'next/image'
import clsx from 'clsx'
import { FoilShineOverlay } from './FoilShineOverlay'
import { RarityBadge } from './RarityBadge'
import { StatusOverlay } from './StatusOverlay'
import { LegacyRibbon } from './LegacyRibbon'
import { CARD_MORPH_SPRING, cardLayoutId } from './cardMorph'
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

/** Props for the {@link TradeCard} component: project data plus the open handler. */
type TradeCardComponentProps = TradeCardProps & {
  /**
   * Opens this project's detail overlay. Drives a full-card stretched button;
   * clicking anywhere on the card morphs it into the `ProjectDetail` panel (the
   * two are linked by a shared `layoutId`). Projects with an external `href`
   * also expose a small "View Project" anchor that navigates instead.
   *
   * @param trigger - The card's open button, so the caller can restore focus to
   *   it when the overlay closes. Passed explicitly rather than read from
   *   `document.activeElement` because Safari/Firefox don't focus a button on
   *   mouse click.
   */
  onOpen?: (trigger: HTMLElement) => void
}

/**
 * True when `href` points off-site (absolute `http(s)` URL) rather than to an
 * internal route. External links open in a new tab and, on the gallery card,
 * get a crawlable outbound anchor; internal routes (e.g. `/`) navigate in the
 * same tab and get no card-level anchor. Shared by {@link TradeCard} and the
 * detail panel so both surfaces apply one link policy.
 *
 * @param href - The project's optional link.
 */
export function isExternalHref(href: string | undefined): href is string {
  return !!href && /^https?:\/\//.test(href)
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
 * @param {TradeCardComponentProps} props - Project metadata, visual config, and the open handler
 * @returns {JSX.Element} An animated, styled card component
 */
export const TradeCard: React.FC<TradeCardComponentProps> = ({
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
  legacy = false,
  onOpen,
}) => {
  const reduce = useReducedMotion()
  const showExternalLink = isExternalHref(href)

  const rarityClass = featured
    ? 'border-yellow-400'
    : experimental
      ? 'border-purple-500'
      : 'border-neutral-700'

  return (
    <m.div
      // Shared id with the detail panel drives the open/close morph; dropped
      // under reduced motion so the overlay cross-fades instead of morphing.
      layoutId={reduce ? undefined : cardLayoutId(slug)}
      whileHover={{
        y: -4,
        boxShadow: '0 0 16px rgba(255, 255, 255, 0.2)',
      }}
      transition={{ type: 'tween', duration: 0.3, layout: CARD_MORPH_SPRING }}
      className={clsx(
        'relative rounded-xl border p-4 bg-neutral-900 text-white w-full max-w-xs flex flex-col items-center text-left transition-all overflow-hidden',
        rarityClass
      )}
    >
      {/*
       * Stretched button = the primary "open detail" target. An empty,
       * transparent button laid over the whole card keeps the rich card content
       * (heading, paragraphs, badges) as siblings — not invalid <button>
       * descendants — and lets the external-link anchor sit above it (z-50) as a
       * sibling rather than a nested interactive control. Clicking anywhere on
       * the card except that anchor opens the detail overlay.
       */}
      <button
        type="button"
        onClick={event => onOpen?.(event.currentTarget)}
        aria-label={`Open ${name} details`}
        className="absolute inset-0 z-40 cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-400"
      />

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

      {showExternalLink && (
        // Sits above the stretched button (z-50) so it receives its own clicks
        // and navigates instead of opening the overlay. A real <a> in the
        // initial DOM keeps the outbound project link crawlable and
        // middle/ctrl-clickable from the gallery.
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${name} project (opens in new tab)`}
          className="relative z-50 mt-4 text-xs text-yellow-300 underline hover:text-yellow-100 transition"
        >
          View Project ↗
        </a>
      )}

      <RarityBadge featured={featured} experimental={experimental} />

      {status && <StatusOverlay status={status} />}
    </m.div>
  )
}
