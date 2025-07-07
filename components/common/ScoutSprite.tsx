'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

export const ScoutSprite = () => {
  return (
    <motion.div
      className="absolute left-4 bottom-4 z-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.6 }}
    >
<div className="relative w-200 h-200 sm:w-56 sm:h-56">

        <Image
          src="/sprites/Scout.png"
          alt="Tech Scout"
          fill
          className="object-contain"
        />
      </div>
    </motion.div>
  )
}