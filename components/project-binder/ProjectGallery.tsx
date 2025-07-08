'use client'

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
    stack: ['Next.js', 'TypeScript', 'React', 'Framer Motion', 'Tailwind CSS', 'Vitest'],
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
 * Renders a stylized project card styled like a trading card, used in the binder-style project showcase.
 *
 * This card displays project metadata including title, tech stack, moment of impact, and visual rarity indicators
 * such as "Featured" (foil shine), "Experimental" (purple glow), and status overlays like "Coming Soon" or "In Progress".
 *
 * If `href` is provided, a "View Project" link is rendered at the bottom to open the external site in a new tab.
 *
 * Animations include:
 * - Framer Motion scale/tilt on hover
 * - Shine effects using `mix-blend-mode` + CSS animations
 *
 * @component
 * @param {TradeCardProps} props - Props describing the project and visual styling
 * @param {string} props.name - Display name of the project
 * @param {string} props.slug - Internal slug (not currently used for linking)
 * @param {string} props.tagline - Short description or hook
 * @param {string} props.thumbnailUrl - URL of the image thumbnail (usually 16:9 aspect)
 * @param {string[]} props.stack - Array of tech stack tags (e.g., ['React', 'Tailwind'])
 * @param {string} props.impact - Highlight of the project’s outcome or value
 * @param {number} props.year - Year the project was built
 * @param {string} props.moment - A creative or meaningful moment associated with the project
 * @param {boolean} [props.featured=false] - If true, displays foil shine and special border
 * @param {boolean} [props.experimental=false] - If true, adds a purple glow to indicate novelty
 * @param {'coming-soon'|'in-progress'} [props.status] - Optional badge and shine overlay to show project state
 * @param {string} [props.href] - If set, renders a "View Project" link that opens in a new tab
 *
 * @returns {JSX.Element} A themed trading card component
 */
export const ProjectGallery = () => {
  return (
    <div className="relative min-h-screen bg-[url('/textures/binder-leather.jpg')] bg-cover bg-center px-6 md:px-24 py-12 shadow-[inset_0_0_60px_rgba(0,0,0,0.3)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 p-6">
        {projects.map(project => (
          <TradeCard key={project.slug} {...project} />
        ))}
      </div>

      <div className="absolute inset-y-0 left-1/2 w-[2px] bg-neutral-800/30 shadow-inner z-0" />
    </div>
  )
}
