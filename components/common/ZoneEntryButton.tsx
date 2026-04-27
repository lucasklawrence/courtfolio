'use client'

import { motion } from 'framer-motion'
import React from 'react'

type ZoneEntryButtonProps = {
  id?: string
  icon: React.ReactNode
  label: string
  ariaLabel?: string
  onClick?: () => void
  className?: string
}

/**
 * `ZoneEntryButton` is a reusable, theme-consistent button component designed for court zone navigation.
 * It supports icons, custom labels, hover/tap animations (via Framer Motion), and optional styling or IDs.
 *
 * This button is primarily used in the SVG court UI to represent navigation to different site areas like
 * the Film Room, Locker Room, or Rafters. It can also be used elsewhere to maintain consistent interaction design.
 *
 * @component
 * @example
 * ```tsx
 * <ZoneEntryButton
 *   id="enter-locker-room"
 *   icon="🧳"
 *   label="Enter Locker Room"
 *   ariaLabel="Locker Room — about and interests"
 *   onClick={() => router.push('/locker-room')}
 * />
 * ```
 *
 * @param {string} [id] - Optional HTML ID for targeting, testing, or accessibility.
 * @param {React.ReactNode} icon - The icon (emoji or SVG) displayed to the left of the label.
 * @param {string} label - The visible button text (e.g., "Enter Locker Room").
 * @param {string} [ariaLabel] - Optional descriptive aria-label that overrides the visible text for screen readers (e.g., "Locker Room — about and interests"). When omitted, screen readers fall back to the visible icon + label.
 * @param {() => void} [onClick] - Optional click handler function for navigation or interaction.
 * @param {string} [className] - Optional Tailwind utility string to extend or override styles.
 *
 * @returns {JSX.Element} A stylized, animated button component.
 */
export const ZoneEntryButton: React.FC<ZoneEntryButtonProps> = ({
  id,
  icon,
  label,
  ariaLabel,
  onClick,
  className = '',
}) => {
  return (
    <button
      id={id}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`cursor-pointer flex items-center gap-3 text-yellow-300 bg-[#42210b] hover:bg-[#5a3015] px-6 py-3 rounded-xl shadow-md border border-yellow-400 font-semibold transition duration-200 text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-[#42210b] focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#42210b] ${className}`}
    >
      <span className="text-m" aria-hidden="true">
        {icon}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  )
}
