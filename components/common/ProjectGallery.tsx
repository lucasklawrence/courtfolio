"use client"

import { features } from "process"
import { TradeCard } from "./TradeCard"
import { tr } from "framer-motion/client"

const projects = [
  {
    name: "Bars of the Day",
    slug: "bars-of-the-day",
    tagline: "Rap meets timing",
    thumbnailUrl: "/thumbnails/bars.png",
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
    thumbnailUrl: "/thumbnails/fantasy.png",
    stack: ["Python", "React", "ML"],
    impact: "Won 2024 league",
    year: 2024,
    moment: "Predicted breakout players weekly",
  },
  {
    name: "Skip Trace Portal",
    slug: "skip-trace",
    tagline: "Case management for legal research",
    thumbnailUrl: "/thumbnails/skiptrace.png",
    stack: ["Next.js", "Supabase", "React"],
    impact: "MVP for internal team",
    year: 2025,
    moment: "Replaced email + spreadsheet workflow",
  },
]


export const ProjectGallery = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 p-6">
      {projects.map((project) => (
        <TradeCard key={project.slug} {...project} />
      ))}
    </div>
  )
}
