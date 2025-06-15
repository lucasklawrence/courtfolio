'use client'

import { motion } from 'framer-motion'

export function CourtTutorialSprite({
  stepData,
  onNext,
}: {
  stepData: { x: number; y: number; img: string; text: string }
  onNext: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 120, damping: 12 }}
      style={{ x: stepData.x, y: stepData.y }}
      className="absolute"
    >
      <img
        src={stepData.img}
        alt="Sprite"
        className="w-[80px] h-auto pointer-events-none"
      />

      <div className="relative -top-20 left-20 w-[180px]">
        <div className="bg-white text-black text-xs font-semibold px-3 py-2 rounded-xl shadow-lg border border-gray-200 relative">
          <p>{stepData.text}</p>
          <div className="absolute left-[-10px] top-[30px] w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[10px] border-r-white" />
        </div>
        <button
          onClick={onNext}
          className="mt-2 ml-1 px-2 py-1 text-white bg-orange-600 rounded text-xs hover:bg-orange-700 transition"
        >
          →
        </button>
      </div>
    </motion.div>
  )
}
