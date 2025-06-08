'use client'

import { BannerCard, BannerProps } from '@/components/BannerCard'
import { motion } from 'framer-motion'

type BannerSection = {
  label: string
  icon: string
  banners: BannerProps[]
}

const groupedBanners: BannerSection[] = [
  {
    label: '💻 Tech',
    icon: '💻',
    banners: [
      { year: '2024', title: 'Granted Patent on Network Sync', icon: '📜', category: 'tech' },
      { year: '2025', title: 'Launched Production Grade NMS', icon: '🚀', category: 'tech' },
      {
        year: '2025',
        title: 'Built Internal GitLab Management Portal',
        icon: '🗂️',
        category: 'tech',
      },
    ],
  },
  {
    label: '🎤 Personal',
    icon: '🎤',
    banners: [
      { year: '2025', title: 'Launched Bars of the Day', icon: '🎤', category: 'personal' },
    ],
  },
  {
    label: '🏀 Basketball',
    icon: '🏀',
    banners: [
      {
        year: '2022',
        title: 'DCSA Fall League — High Division Champs',
        icon: '🥇',
        category: 'basketball',
      },
      {
        year: '2023',
        title: 'DCSA Winter League — Mythical 5 Selection',
        icon: '🌟',
        category: 'basketball',
      },
      {
        year: '2023',
        title: 'DCSA Summer League — 40+ Division Champs',
        icon: '🏆',
        category: 'basketball',
      },
      {
        year: '2024',
        title: 'KBL Season 5 — Legends vs Rookies Champs',
        icon: '🧢',
        category: 'basketball',
      },
      { year: '2025', title: 'KBL Season 6 — All Star Champs', icon: '⭐', category: 'basketball' },
    ],
  },
]

export default function BannersPage() {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="relative min-h-screen text-white overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900/90 to-black z-0" />

        {/* Content */}
        <div className="relative z-10 px-4 py-16 text-center">
          <h1 className="text-4xl font-bold">🏟️ The Rafters</h1>
          <p className="text-lg mt-2 mb-12 text-gray-300">Where legacies hang forever.</p>

          {groupedBanners.map((section, sectionIdx) => (
            <div key={sectionIdx} className="mb-20">
              <h2 className="text-2xl font-semibold text-white mb-6">{section.label}</h2>
              <div className="flex flex-wrap justify-center gap-12">
                {section.banners.map((b, idx) => (
                  <BannerCard
                    key={idx}
                    {...b}
                    swayDelay={idx * 0.4}
                    swayAmount={1.2 + Math.random() * 0.6}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-20">
            <a href="/" className="text-orange-300 underline hover:text-orange-100">
              ← Back to the Court
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
