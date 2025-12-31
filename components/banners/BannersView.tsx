'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { BannerCard, BannerProps } from '@/components/common/BannerCard'

export type BannerSection = {
  label: string
  icon: string
  banners: BannerProps[]
}

export function BannersView({ sections }: { sections: BannerSection[] }) {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/90 to-black z-0" />

        <div className="relative z-10 px-4 py-16 text-center">
          <h1 className="text-4xl font-bold">dY?Y‹,? The Rafters</h1>
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

          <div className="mt-20">
            <Link href="/" className="text-orange-300 underline hover:text-orange-100">
              ƒ+? Back to the Court
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
