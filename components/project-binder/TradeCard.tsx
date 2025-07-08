'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import clsx from 'clsx'
import { BackToCourtButton } from '../common/BackToCourtButton'

export type TradeCardProps = {
  name: string
  slug: string
  tagline: string
  thumbnailUrl: string
  stack: string[]
  impact: string
  year: number
  moment: string
  featured?: boolean
  experimental?: boolean
  status?: 'coming-soon' | 'in-progress' | undefined
}

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
      {featured && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="foil-shine w-full h-full absolute top-0 left-0" />
        </div>
      )}

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

      {featured && (
        <div className="absolute top-2 right-2 text-xs bg-yellow-300 text-black px-2 py-0.5 rounded shadow">
          ⭐ Featured
        </div>
      )}

      {experimental && (
        <div className="absolute top-2 left-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded shadow">
          🧪 Experimental
        </div>
      )}

      {status === 'coming-soon' && (
        <>
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="coming-soon-shine w-full h-full absolute top-0 left-0" />
          </div>
          <div className="absolute top-2 right-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded shadow z-30">
            ⏳ Coming Soon
          </div>
        </>
      )}

      {status === 'in-progress' && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="in-progress-shine w-full h-full absolute top-0 left-0" />
          <div className="absolute top-2 right-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded shadow">
            🚧 In Progress
          </div>
        </div>
      )}

      <style jsx>{`
        .foil-shine {
          background: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0.05) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0.05) 100%
          );
          transform: rotate(25deg);
          animation: shine 2.5s infinite linear;
          opacity: 0.6;
          mix-blend-mode: screen;
        }

        @keyframes shine {
          0% {
            transform: translateX(-100%) rotate(25deg);
          }
          100% {
            transform: translateX(100%) rotate(25deg);
          }
        }
      `}</style>
      <style jsx>{`
        .in-progress-shine {
          background: linear-gradient(
            135deg,
            rgba(0, 120, 255, 0.05) 0%,
            rgba(0, 120, 255, 0.15) 50%,
            rgba(0, 120, 255, 0.05) 100%
          );
          transform: rotate(10deg);
          animation: inProgressShine 4s infinite linear;
          opacity: 0.3;
          mix-blend-mode: screen;
        }

        @keyframes inProgressShine {
          0% {
            transform: translateX(-100%) rotate(10deg);
          }
          100% {
            transform: translateX(100%) rotate(10deg);
          }
        }
      `}</style>
      <style jsx>{`
        .coming-soon-shine {
          background: linear-gradient(
            90deg,
            rgba(180, 100, 255, 0.05) 0%,
            rgba(180, 100, 255, 0.3) 50%,
            rgba(180, 100, 255, 0.05) 100%
          );
          animation: comingSoonSweep 5s infinite ease-in-out;
          opacity: 0.25;
          mix-blend-mode: screen;
        }

        @keyframes comingSoonSweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </motion.div>
  )
}
