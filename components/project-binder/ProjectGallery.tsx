'use client'

import { useSingleColumn } from '@/utils/hooks/useSingleColumn'
import { TradeCard } from './TradeCard'
import type { TradeCardProps } from './TradeCard'

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
 * Renders a gallery of featured projects as stylized trading cards inside a binder layout.
 *
 * This component displays a responsive grid of `TradeCard` components, styled to evoke a collectible binder.
 * A vertical binder ring is conditionally rendered at the center when in single-column (mobile) view
 * to enhance the visual metaphor on smaller screens.
 *
 * Key Features:
 * - Responsive grid layout: 1 column on mobile, 2+ on larger screens
 * - Trading card–style project tiles with animation and status effects
 * - Conditional vertical binder ring for 1-column layout (mobile)
 * - Background uses leather texture with inset shadow styling
 *
 * @component
 * @returns {JSX.Element} A styled gallery of interactive project cards
 */
export const ProjectGallery = () => {
  const isSingleColumn = useSingleColumn()

  return (
    <div className="relative min-h-screen bg-[url('/textures/binder-leather.jpg')] bg-cover bg-center px-6 md:px-24 py-12 shadow-[inset_0_0_60px_rgba(0,0,0,0.3)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 p-6">
        {projects.map(project => (
          <TradeCard key={project.slug} {...project} />
        ))}
      </div>

      {isSingleColumn && (
        <div className="absolute inset-y-0 left-1/2 w-[2px] bg-neutral-800/30 shadow-inner z-0" />
      )}
    </div>
  )
}
