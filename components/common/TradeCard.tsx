"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import clsx from "clsx"

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
}) => {
  const rarityClass = featured
    ? "border-yellow-400 shadow-[0_0_20px_4px_rgba(255,255,0,0.4)]"
    : experimental
    ? "border-purple-500 shadow-[0_0_10px_3px_rgba(180,0,255,0.3)]"
    : "border-neutral-700"

  return (
    <motion.div
      whileHover={{ scale: 1.05, rotate: -1 }}
      className={clsx(
        "relative rounded-xl border p-4 bg-neutral-900 text-white w-full max-w-xs flex flex-col items-center transition-all",
        rarityClass
      )}
    >
      <div className="w-full aspect-video relative rounded-md overflow-hidden border border-neutral-600 bg-black">
        <Image src={thumbnailUrl} alt={name} fill className="object-cover" />
      </div>

      <h3 className="mt-4 text-lg font-bold text-center leading-tight">{name}</h3>
      <p className="text-sm text-neutral-400 italic text-center">{tagline}</p>

      <div className="mt-2 text-xs text-yellow-200 space-y-1 text-center">
        <div>🏆 {impact}</div>
        <div>📅 {year} · ⚙️ {stack.join(", ")}</div>
        <div className="text-yellow-100 text-xs">🔥 {moment}</div>
      </div>

      <Link
        href={`/film-room/${slug}`}
        className="mt-4 px-4 py-2 text-sm bg-yellow-400 text-black rounded-md font-bold hover:bg-yellow-300"
      >
        🎞️ View Film
      </Link>

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
    </motion.div>
  )
}
