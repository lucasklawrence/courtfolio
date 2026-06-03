'use client'

import { m } from 'framer-motion'
import { BannerCard, BannerProps } from '@/components/common/BannerCard'
import { NextStopNav } from '@/components/common/NextStopNav'
import { BackToCourtButton } from '@/components/common/BackToCourtButton'

/** A labeled group of {@link BannerCard}s rendered together under a heading. */
export type BannerSection = {
  /** Section heading shown above its banners. */
  label: string
  /** Emoji/glyph associated with the section. */
  icon: string
  /** Banners belonging to this section. */
  banners: BannerProps[]
}

/** Props for {@link BannersView}. */
type BannersViewProps = {
  /** Ordered banner groups to display top-to-bottom. */
  sections: BannerSection[]
}

/**
 * "The Rafters" page view — renders championship/achievement banners grouped
 * into labeled sections (each banner swaying independently via {@link BannerCard})
 * plus next-stop navigation. Fades and scales in on mount.
 *
 * @param props - {@link BannersViewProps}.
 */
export function BannersView({ sections }: BannersViewProps) {
  return (
    <m.div
      className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/90 to-black z-0" />

        <div className="relative z-10 px-4 py-16 text-center">
          <h1 className="text-4xl font-bold">The Rafters</h1>
          <p className="text-lg mt-2 mb-12 text-gray-300">Where legacies hang forever.</p>

          {sections.map((section, sectionIdx) => (
            <div key={sectionIdx} className="mb-20">
              <h2 className="text-2xl font-semibold text-white mb-6">{section.label}</h2>
              <div className="flex flex-wrap justify-center gap-12">
                {section.banners.map((banner, idx) => (
                  <BannerCard
                    key={idx}
                    {...banner}
                    swayDelay={idx * 0.4}
                    swayAmount={1.2 + Math.random() * 0.6}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-20 flex flex-wrap items-center justify-center gap-3">
            <NextStopNav current="rafters" />
            <BackToCourtButton />
          </div>
        </div>
      </div>
    </m.div>
  )
}
