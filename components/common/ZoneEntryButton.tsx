'use client'

import { motion } from 'framer-motion'
import React from 'react'

type ZoneEntryButtonProps = {
  id?: string
  icon: React.ReactNode
  label: string
  onClick?: () => void
  className?: string
}

export const ZoneEntryButton: React.FC<ZoneEntryButtonProps> = ({
  id,
  icon,
  label,
  onClick,
  className = '',
}) => {
  return (
    <motion.button
      id={id}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`cursor-pointer flex items-center gap-3 text-yellow-300 bg-[#42210b] hover:bg-[#5a3015] px-6 py-3 rounded-xl shadow-md border border-yellow-400 font-semibold transition duration-200 text-base sm:text-lg ${className}`}
    >
      <span className="text-m">{icon}</span>
      <span  className="whitespace-nowrap">{label}</span>
    </motion.button>
  )
}
