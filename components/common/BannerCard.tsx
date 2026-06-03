'use client'

import { m } from 'framer-motion'

/** Props for {@link BannerCard}. */
export type BannerProps = {
  /** Season/championship year shown at the top of the banner (e.g. "2024"). */
  year: string
  /** Banner caption / achievement title. */
  title: string
  /** Optional emoji or glyph displayed above the title. */
  icon?: string
  /** Optional category grouping label (used by callers to group banners). */
  category?: string
  /** Seconds to delay the sway loop so adjacent banners sway out of phase. Default `0`. */
  swayDelay?: number
  /** Peak sway rotation in degrees. Default `1.5`. */
  swayAmount?: number
}

/**
 * A single hanging "rafters" banner: a cloth panel with a hanging bar, rope,
 * year, icon, and title that sways continuously on an eased rotate loop. Used
 * by {@link BannersView}.
 *
 * @param props - {@link BannerProps}.
 */
export function BannerCard({ year, title, icon, swayDelay = 0, swayAmount = 1.5 }: BannerProps) {
  return (
    <m.div
      className="relative w-32 h-64 bg-yellow-300 text-black flex flex-col items-center justify-start pt-6 px-2 rounded-t-md shadow-xl"
      animate={{ rotate: [0, swayAmount, -swayAmount, 0] }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: 'easeInOut',
        times: [0, 0.25, 0.75, 1],
        delay: swayDelay,
      }}
    >
      {/* Hanging bar */}
      <div className="absolute -top-2 w-10 h-2 bg-gray-800 rounded-full" />

      {/* Optional rope visual */}
      <svg className="absolute -top-5 left-1/2 transform -translate-x-1/2" width="40" height="10">
        <line x1="0" y1="0" x2="20" y2="10" stroke="gray" strokeWidth="2" />
        <line x1="40" y1="0" x2="20" y2="10" stroke="gray" strokeWidth="2" />
      </svg>

      <div className="text-lg font-bold">{year}</div>
      <div className="text-3xl mt-2">{icon}</div>
      <div className="text-center text-sm font-semibold mt-4 px-1">{title}</div>

      <div
        className="absolute bottom-[-20px] left-1/2 transform -translate-x-1/2 w-0 h-0 
        border-l-[32px] border-r-[32px] border-t-[32px] 
        border-l-transparent border-r-transparent border-t-yellow-300"
      />
    </m.div>
  )
}
