'use client'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { ProjectGallery } from '@/components/project-binder/ProjectGallery'
import React from 'react'

/**
 * Renders the Project Binder page of the portfolio site.
 *
 * This page displays a trading card–style grid of featured projects inside a themed binder layout.
 * It includes a background texture, binder ring styling, and top overlays for navigation and labeling.
 *
 * Key features:
 * - Project cards styled as collectible items
 * - Background leather texture and binder ring
 * - "Back to Court" and page marker overlay at the top
 * - Responsive layout for all screen sizes
 *
 * @returns {JSX.Element} The rendered ProjectPage component
 */
export default function ProjectPage() {
  return (
    <div className="bg-[url('/textures/binder-leather.png')] bg-center bg-cover bg-no-repeat min-h-screen flex flex-col relative">
      {/* Binder Ring */}
      <div className="hidden md:block absolute inset-y-0 left-1/2 w-[2px] bg-neutral-800/40 shadow-inner z-0" />

      {/* Overlay buttons (moved to top) */}
      <div className="w-full px-4 pt-4 pb-2 z-10">
        <div className="max-w-7xl mx-auto w-full flex justify-between">
          <div className="text-xs bg-black/30 text-white px-3 py-1 font-mono rounded-tr-md">
            Page 1
          </div>
          <div className="text-xs bg-black/30 text-white px-3 py-1 font-mono rounded-tr-md">
            <BackToCourtButton />
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-grow">
        {/* Binder label */}
        <div className="max-w-7xl mx-auto px-4 pt-2 pb-1">
          <div className="text-yellow-200 uppercase tracking-wide text-sm font-mono">
            Lucas Lawrence // Tech Stack Binder
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 pb-2">
          <div className="flex gap-3 text-yellow-200 text-xs font-mono uppercase tracking-widest">
            <button className="underline underline-offset-2">All</button>
          </div>
        </div>

        {/* Project cards */}
        <div className="max-w-7xl mx-auto px-4 pb-4">
          <ProjectGallery />
        </div>
      </main>
    </div>
  )
}
