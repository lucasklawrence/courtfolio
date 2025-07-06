'use client'

import React, { useState } from 'react'
import { CourtContainer } from '@/components/court/CourtContainer'
import { CourtZone } from '@/components/court/CourtZone'
import { SafeSvgHtml } from '@/components/common/SafeSvgHtml'
import { AudienceSvg } from '@/components/film-room/Audience'
import { FilmRoomSvg } from '@/components/film-room/FilmRoomSvg'
import { ProjectorSvg } from '@/components/film-room/Projector'
import { ProjectorLightSvg } from '@/components/film-room/ProjectorLight'
import { FilmRoomSignSvg } from '@/components/film-room/FilmRoomSign'
import { FilmRoomZone } from '@/components/film-room/FilmRoomZone'
import { FilmRoomContainer } from '@/components/film-room/FilmRoomContainer'
import { motion } from 'framer-motion'
import { ProjectSelector } from '@/components/film-room/ProjectSelector'
import { Project } from '@/components/film-room/data/project'
import { ProjectSlideRenderer } from '@/components/film-room/ProjectSlideRenderer'
import { projects } from '@/components/film-room/data/filmRoomProjects'
import { LucasPresentingSvg } from '@/components/film-room/LucasPresenting'

export default function FilmRoomPage() {
  const [frameIndex, setFrameIndex] = useState(0)
const [selectedProject, setSelectedProject] = useState<Project | null>(null)
const [currentSlide, setCurrentSlide] = useState(0)

  const zoneContent = {
   'zone-screen': (
  <CourtZone x={350} y={100} width={800} height={500}>
    <SafeSvgHtml>
                <div className="flex flex-col items-center justify-center w-full h-full text-white bg-white/5 backdrop-blur-md rounded-md shadow-[0_0_40px_10px_rgba(255,255,255,0.1)]">

      {selectedProject ? (
        <ProjectSlideRenderer project={selectedProject}
                          onBackToSelect={() => setSelectedProject(null)}
                          currentSlide={currentSlide} setCurrentSlide={setCurrentSlide}/>
      ) : (
        <>
          <h1 className="text-4xl font-bold text-center drop-shadow-lg">Welcome to the Film Room</h1>
          <p className="mt-4 text-lg text-center text-gray-300 drop-shadow">A deep dive into my builds — one frame at a time.</p>
          <ProjectSelector onSelect={slug => {
            const project = projects.find(p => p.slug === slug)
            if (project) setSelectedProject(project)
          }} /></>
      )}
              </div>

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
  }

  return (
    <FilmRoomContainer>
      <FilmRoomSvg zoneContent={zoneContent} />
      </FilmRoomContainer>
  )
}
