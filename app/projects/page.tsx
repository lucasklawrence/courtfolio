import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { SectionContainer } from '@/components/common/SectionContainer'
import { ProjectGallery } from '@/components/project-binder/ProjectGallery'
import React from 'react'

/**
 * Renders the Project Binder page of the portfolio site.
 *
 * This page displays a trading card–style grid of featured projects inside a themed binder layout.
 * It includes a background texture, binder ring styling, and top overlays for navigation and labeling.
 *
 * @returns {JSX.Element} The rendered ProjectPage component
 */
export default function ProjectPage() {
  return (
    <div className="bg-[url('/textures/binder-leather.png')] bg-center bg-cover bg-no-repeat min-h-screen flex flex-col relative">
      {/* Header Controls */}
      <SectionContainer className="pt-4 pb-2 z-10 flex justify-between">
        <div className="text-xs bg-black/30 text-white px-3 py-1 font-mono rounded-tr-md">
          Page 1
        </div>
        <div className="text-xs bg-black/30 text-white px-3 py-1 font-mono rounded-tr-md">
          <BackToCourtButton />
        </div>
      </SectionContainer>

      {/* Main content */}
      <main className="flex-grow w-full">
        <SectionContainer className="pt-2 pb-1">
          <div className="text-yellow-200 uppercase tracking-wide text-sm font-mono">
            Lucas Lawrence // Tech Stack Binder
          </div>
        </SectionContainer>

        <SectionContainer className="pb-2">
          <div className="flex gap-3 text-yellow-200 text-xs font-mono uppercase tracking-widest">
            <button className="underline underline-offset-2">All</button>
          </div>
        </SectionContainer>

        <ProjectGallery />
      </main>
    </div>
  )
}
