'use client'

import React, { useState, useEffect } from 'react'
import { CourtZone } from '@/components/court/CourtZone'
import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'
import { AudienceSvg } from '@/components/film-room/Audience'
import { FilmRoomSvg } from '@/components/film-room/FilmRoomSvg'
import { ProjectorSvg } from '@/components/film-room/Projector'
import { ProjectorLightSvg } from '@/components/film-room/ProjectorLight'
import { FilmRoomSignSvg } from '@/components/film-room/FilmRoomSign'
import { FilmRoomZone } from '@/components/film-room/FilmRoomZone'
import { FilmRoomContainer } from '@/components/film-room/FilmRoomContainer'
import { AnimatePresence, motion } from 'framer-motion'
import { ProjectSelector } from '@/components/film-room/ProjectSelector'
import { Project } from '@/components/film-room/data/project'
import { ProjectSlideRenderer } from '@/components/film-room/ProjectSlideRenderer'
import { projects } from '@/components/film-room/data/filmRoomProjects'
import { LucasPresentingSvg } from '@/components/film-room/LucasPresenting'
import { FilmRoomScreenContainer } from '@/components/film-room/FilmRoomSceneContainer'
import { SpeechBubble } from '@/components/common/SpeechBubble'

export default function FilmRoomPage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [visibleReaction, setVisibleReaction] = useState<{
    text: string
    speaker: 'audience' | 'sprite' | 'coach'
    position?: { x: number; y: number }
  } | null>(null)

  const currentReaction = selectedProject?.slides?.[currentSlide]?.reaction ?? null

  // Show reaction and auto-dismiss after 3 seconds
useEffect(() => {
  if (currentReaction) {
    setVisibleReaction(currentReaction)
    const timer = setTimeout(() => setVisibleReaction(null), 3000)
    return () => clearTimeout(timer)
  } else {
    // Ensure bubble is cleared if new slide has no reaction
    setVisibleReaction(null)
  }
}, [currentReaction])

  const zoneContent = {
    'zone-screen': (
      <CourtZone x={350} y={100} width={800} height={500}>
        <SafeSvgHtml>
          <FilmRoomScreenContainer>
            {selectedProject ? (
              <ProjectSlideRenderer
                project={selectedProject}
                onBackToSelect={() => setSelectedProject(null)}
                currentSlide={currentSlide}
                setCurrentSlide={setCurrentSlide}
              />
            ) : (
              <ProjectSelector
                onSelect={(slug) => {
                  const project = projects.find((p) => p.slug === slug)
                  if (project) setSelectedProject(project)
                }}
              />
            )}
          </FilmRoomScreenContainer>
        </SafeSvgHtml>
      </CourtZone>
    ),
    'zone-projector': (
      <FilmRoomZone x={1350} y={20} width={200} height={200}>
        <ProjectorSvg />
      </FilmRoomZone>
    ),
    'zone-sign': (
      <FilmRoomZone x={0} y={20} width={350} height={350}>
        <FilmRoomSignSvg />
      </FilmRoomZone>
    ),
    'zone-projector-light': (
      <FilmRoomZone x={1280} y={110} width={120} height={100}>
        <motion.g
          animate={{
            opacity: [0.9, 1, 0.85, 1],
            filter: ['brightness(1)', 'brightness(0.9)', 'brightness(1.1)', 'brightness(1)'],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ProjectorLightSvg className="rotate-[85deg]" />
        </motion.g>
      </FilmRoomZone>
    ),
    'zone-audience': (
      <FilmRoomZone x={0} y={620} width={1536} height={350}>
        <div className="w-full h-full relative">
          <AudienceSvg className="w-full h-full absolute bottom-0 left-0" />
          <div className="absolute bottom-0 left-0 w-full h-[40px] bg-black/40 blur-md" />
        </div>
      </FilmRoomZone>
    ),
    'zone-presenter': (
      <FilmRoomZone x={1200} y={220} width={336} height={650}>
        <LucasPresentingSvg className="w-full h-full absolute bottom-0 left-0" />
      </FilmRoomZone>
    ),
    'zone-comment': (
      <AnimatePresence>
        {visibleReaction && (
          <FilmRoomZone
            x={visibleReaction.position?.x ?? 200}
            y={visibleReaction.position?.y ?? 750}
            width={500}
            height={650}
          >
            <motion.div
              key={`reaction-${currentSlide}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <SpeechBubble
                text={visibleReaction.text}
                scale={1}
                facingLeft={visibleReaction.speaker === 'sprite'}
              />
            </motion.div>
          </FilmRoomZone>
        )}
      </AnimatePresence>
    ),
  }

  return (
    <FilmRoomContainer>
      <FilmRoomSvg zoneContent={zoneContent} />
    </FilmRoomContainer>
  )
}
