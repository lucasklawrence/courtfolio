"use client"

import { TradeCard } from "./TradeCard"

const projects = [
  {
    name: "Bars of the Day",
    slug: "bars-of-the-day",
    tagline: "Rap meets timing",
    thumbnailUrl: "/thumbnails/BarsofTheDayThumbnail.png",
    stack: ["Next.js", "Tailwind", "Supabase"],
    impact: "Used in portfolio",
    year: 2025,
    moment: "Synced lyrics to audio playback",
    featured: true
  },
  {
    name: "Fantasy Football AI",
    slug: "fantasy-football-ai",
    tagline: "AI-driven draft & weekly picks",
    thumbnailUrl: "/thumbnails/FantasyThumbnail.png",
    stack: ["Python", "React", "ML"],
    impact: "Won 2024 league",
    year: 2024,
    moment: "Predicted breakout players weekly",
  },
  {
    name: "Skip Trace Portal",
    slug: "skip-trace",
    tagline: "Case management for legal research",
    thumbnailUrl: "/thumbnails/SkipTracerThumbnail.png",
    stack: ["Next.js", "Supabase", "React"],
    impact: "MVP for internal team",
    year: 2025,
    moment: "Replacing email + spreadsheet workflow",
    status: "in-progress"
  },
    {
    name: "Courtfolio",
    slug: "courtfolio",
    tagline: "A basketball-themed portfolio that plays like a game",
    thumbnailUrl: "/thumbnails/CourtfolioThumbnail.png",
    stack: ["Next.js", "SVG", "Framer Motion", "Tailwind CSS"],
    impact: "Interactive showcase of work and creativity",
    year: 2025,
    moment: "Mapped entire site onto a basketball court with animated SVGs",
    featured: true,
  },
{
  name: "GitLab Management Portal",
  slug: "gitlab-portal",
  tagline: "Visualize GitLab project plans with trees, swimlanes, and Gantt charts",
  thumbnailUrl: "/thumbnails/GitlabThumbnail.png",
  stack: ["Next.js", "TypeScript", "React", "Framer Motion", "Tailwind CSS", "Vitest"],
  impact: "Streamlines planning by transforming GitLab epics and issues into interactive trees and timelines",
  year: 2025,
  moment: "Built a dependency-aware Gantt chart and tree view with milestone filtering and progress tracking",
  featured: true,
},
]


export const ProjectGallery = () => {
  return (
    <div
  className="relative min-h-screen bg-[url('/textures/binder-leather.jpg')] bg-cover bg-center px-6 md:px-24 py-12 shadow-[inset_0_0_60px_rgba(0,0,0,0.3)]"
>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 p-6">
      {projects.map((project) => (
        <TradeCard key={project.slug} {...project} />
      ))}
    </div>

    <div className="absolute inset-y-0 left-1/2 w-[2px] bg-neutral-800/30 shadow-inner z-0" />


    </div>
  )
}
