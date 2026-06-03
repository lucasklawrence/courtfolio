'use client'

import { AnimatePresence } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import { useSingleColumn } from '@/utils/hooks/useSingleColumn'
import { TradeCard } from './TradeCard'
import type { TradeCardProps } from './TradeCard'
import { ProjectDetail } from './ProjectDetail'

const projects: TradeCardProps[] = [
  {
    name: 'Courtfolio',
    slug: 'courtfolio',
    tagline: 'This site — a basketball-themed portfolio that plays like a game',
    thumbnailUrl: '/thumbnails/CourtFolioThumbnail.png',
    stack: ['Next.js', 'SVG', 'Framer Motion', 'Tailwind CSS'],
    impact: 'Interactive showcase of work and creativity',
    year: 2025,
    moment: 'Mapped the entire site onto a basketball court and themed rooms with SVGs',
    featured: true,
    href: '/',
  },
  {
    name: 'GitLab Management Portal',
    slug: 'gitlab-portal',
    tagline: 'Visualize GitLab project plans with trees, swimlanes, and Gantt charts',
    thumbnailUrl: '/thumbnails/GitlabThumbnail.png',
    stack: ['Next.js', 'TypeScript', 'React', 'Tailwind CSS', 'Material UI', 'Vitest'],
    impact:
      'Streamlines planning by transforming GitLab epics and issues into interactive trees and timelines',
    year: 2025,
    moment:
      'Built a dependency-aware Gantt chart and tree view with milestone filtering and progress tracking',
    featured: true,
  },
  {
    name: 'Dad Memorial Site',
    slug: 'dad-memorial',
    tagline: 'A tribute to the greatest influence on the man I’ve become',
    thumbnailUrl: '/thumbnails/DadMemorial.png',
    stack: ['Next.js', 'TypeScript', 'React', 'Tailwind CSS', 'Supabase'],
    impact:
      'Honors my dad’s life with a Memory Wall and Letter section — a place for our family to contribute, share, and remember together',
    year: 2025,
    moment:
      'Shipped a respectful, low-friction flow for posting memories with admin review (Supabase Auth + RLS) and crafted elegant letter/tribute card components with subtle motion.',
    featured: true,
    href: 'https://flolawrence.life',
  },
  {
    name: 'Bars of the Day',
    slug: 'bars-of-the-day',
    tagline: 'Daily rap bars with style',
    thumbnailUrl: '/thumbnails/BarsOfTheDayThumbnail.png',
    stack: ['Next.js', 'Tailwind', 'Supabase'],
    impact: 'Daily creative expression and portfolio flair',
    year: 2025,
    moment: 'Displays one rap bar per day with archive view',
    featured: true,
    href: 'https://barsoftheday.com',
  },
  {
    name: 'R-Learning Snake',
    slug: 'r-learning-snake',
    tagline: 'Snake that learns through reinforcement',
    thumbnailUrl: '/thumbnails/SnakeThumbnail.png',
    stack: ['Python', 'PyGame', 'Reinforcement Learning'],
    impact: 'Taught an AI agent to master classic Snake via trial and error',
    year: 2019,
    moment: 'The agent starts clueless and learns to survive and grow over time',
    featured: true,
  },
  {
    name: 'OCR Document Scanner',
    slug: 'ocr-scanner',
    tagline: 'Realtime document OCR pipeline on DSP hardware',
    thumbnailUrl: '/thumbnails/OcrThumbnail.png',
    stack: ['C', 'TI DSP Board', 'Image Processing'],
    impact:
      'Senior capstone at UCLA — built a full embedded pipeline for document classification and OCR',
    year: 2016,
    moment:
      'Captured document images on board, ran preprocessing, and extracted structured text via embedded logic',
    featured: false,
    legacy: true,
  },
  {
    name: 'Skip Trace Portal',
    slug: 'skip-trace',
    tagline: 'Case management for legal research',
    thumbnailUrl: '/thumbnails/SkipTracerThumbnail.png',
    stack: ['Next.js', 'Supabase', 'React'],
    impact: 'MVP for internal team',
    year: 2025,
    moment: 'Replacing email + spreadsheet workflow',
    status: 'in-progress',
  },
  {
    name: 'Fantasy Football AI',
    slug: 'fantasy-football-ai',
    tagline: 'AI-driven draft & weekly picks',
    thumbnailUrl: '/thumbnails/FantasyThumbnail.png',
    stack: ['Python', 'React', 'ML'],
    impact: 'Won 2024 league',
    year: 2025,
    moment: 'Predict breakout players weekly',
    status: 'coming-soon',
  },
]
/**
 * Renders a full-width binder layout with a responsive split-column design.
 *
 * Projects are split evenly into left/right columns to preserve binder symmetry.
 * On small screens, the layout collapses into a single vertical column.
 */
export const ProjectGallery = () => {
  const isSingleColumn = useSingleColumn()

  // Slug of the project whose detail overlay is open, or null when none is.
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const selectedProject = projects.find(project => project.slug === selectedSlug) ?? null

  // The card button that opened the overlay, so focus can be restored to it on
  // close. The card passes its button element directly (rather than us reading
  // `document.activeElement`) because Safari/Firefox don't focus a button on
  // mouse click, and because the gallery is marked `inert` on open — which would
  // blur the trigger before the dialog could capture it.
  const triggerRef = useRef<HTMLElement | null>(null)
  const openProject = (slug: string, trigger: HTMLElement) => {
    triggerRef.current = trigger
    setSelectedSlug(slug)
  }
  // Stable identity so the dialog's keydown/scroll-lock/focus effect doesn't
  // re-run (and leak the scroll lock) when the gallery re-renders while open
  // — e.g. a viewport resize flipping `useSingleColumn`.
  const closeProject = useCallback(() => setSelectedSlug(null), [])

  const mid = Math.ceil(projects.length / 2)
  const leftColumn = projects.slice(0, mid)
  const rightColumn = projects.slice(mid)

  return (
    <div className="relative min-h-screen bg-[url('/textures/binder-leather.png')] bg-cover bg-center px-2 sm:px-6 py-12 shadow-[inset_0_0_60px_rgba(0,0,0,0.3)]">
      {/*
       * The card grid is marked `inert` while the detail dialog is open, so the
       * cards obscured behind the backdrop leave the tab order and the
       * accessibility tree — completing the dialog's focus trap + aria-modal so
       * a screen-reader virtual cursor can't wander into the hidden gallery.
       * (The divider below is decorative and non-interactive, so it's exempt.)
       */}
      <div
        data-testid="gallery-content"
        inert={selectedProject ? true : undefined}
        className="mx-auto w-full max-w-[1600px]"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-2 sm:px-4">
          {/* Left Column */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 sm:justify-items-start justify-items-center">
            {leftColumn.map(project => (
              // `.reveal` fades each card up as it scrolls into view (native
              // scroll-driven CSS; inert in unsupporting browsers / reduced motion).
              <div key={project.slug} className="reveal">
                <TradeCard {...project} onOpen={trigger => openProject(project.slug, trigger)} />
              </div>
            ))}
          </div>

          {/* Right Column */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6 sm:justify-items-start justify-items-center">
            {rightColumn.map(project => (
              <div key={project.slug} className="reveal">
                <TradeCard {...project} onOpen={trigger => openProject(project.slug, trigger)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isSingleColumn && (
        <div className="absolute inset-y-0 left-1/2 w-[2px] bg-neutral-800/30 shadow-inner z-10 pointer-events-none" />
      )}

      {/* Shared-element morph target: the selected card flies open into this
          overlay and back. AnimatePresence keeps it mounted through the exit. */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectDetail
            key={selectedProject.slug}
            project={selectedProject}
            onClose={closeProject}
            returnFocusTo={triggerRef}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
