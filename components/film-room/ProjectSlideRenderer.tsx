'use client'

import React from 'react'
import { Project, SlideSection } from './data/project'
import { motion, AnimatePresence } from 'framer-motion'
import { SlideRenderer } from './SlideRenderer'

type Props = {
  project: Project
  currentSlide: number
  setCurrentSlide: (index: number) => void
  onBackToSelect: () => void
}

export const ProjectSlideRenderer: React.FC<Props> = ({
  project,
  currentSlide,
  setCurrentSlide,
  onBackToSelect,
}) => {
  const slides = project.slides || []

  if (slides.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white text-xl italic">
        No slides available for this project.
        <button
          onClick={onBackToSelect}
          className="mt-4 px-4 py-2 bg-white/10 border border-white/20 rounded hover:bg-white/20 transition"
        >
          Back to Project Select
        </button>
      </div>
    )
  }

  const goNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1)
    } else {
      onBackToSelect()
      setCurrentSlide(0) // finish the project, return to selector
    }
  }
  const goPrev = () => setCurrentSlide(Math.max(currentSlide - 1, 0))

  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center px-6 py-4 text-white bg-white/5 rounded-md backdrop-blur-md shadow-[0_0_40px_10px_rgba(255,255,255,0.1)] overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
          className="w-full h-full overflow-y-auto"
        >
          <SlideRenderer section={slides[currentSlide]} />
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6 text-sm">
        <button
          onClick={goPrev}
          disabled={currentSlide === 0}
          className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          Prev
        </button>
        <span className="text-gray-400">
          {currentSlide + 1} / {slides.length}
        </span>
        <button
          onClick={goNext}
          className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          {currentSlide === slides.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  )
}
