'use client'

import { BackToCourtButton } from '@/components/common/BackToCourtButton'
import { ProjectGallery } from '@/components/common/ProjectGallery'
import { ScoutSprite } from '@/components/common/ScoutSprite'
import React from 'react'

export default function ProjectPage() {
  return (
    <div className="relative min-h-screen bg-[url('/textures/binder-leather.png')] bg-cover bg-center px-6 md:px-24 py-12">
      {/* Binder ring divider */}
      <div className="absolute inset-y-0 left-1/2 w-[2px] bg-neutral-800/40 shadow-inner z-0" />

      {/* Content wrapper */}
      <div className="relative z-10 w-full">
        {/* Binder label */}
        <div className="text-yellow-200 uppercase tracking-wide text-sm px-6 pb-4 font-mono">
          Lucas Lawrence // Tech Stack Binder
        </div>

        {/* Scout Sprite */}
        <div className="absolute right-4 bottom-4">
          <ScoutSprite />
        </div>
        {/* Optional section tabs */}
        <div className="flex gap-6 text-yellow-200 text-xs font-mono px-6 pb-6 uppercase tracking-widest">
          <button className="underline underline-offset-2">All</button>
          <button className="opacity-70 hover:opacity-100">2024</button>
          <button className="opacity-70 hover:opacity-100">2025</button>
          <button className="opacity-70 hover:opacity-100">Featured</button>
        </div>

        {/* Card grid */}
        <div className="max-w-7xl mx-auto">
          <ProjectGallery />
        </div>
      </div>

      <div className="absolute bottom-10 right-10 text-xs bg-black/30 text-white px-3 py-1 font-mono rounded-tr-md">
        <BackToCourtButton />
      </div>

      {/* Page marker */}
      <div className="absolute bottom-0 left-0 text-xs bg-black/30 text-white px-3 py-1 font-mono rounded-tr-md">
        Page 1 // Film Ready
      </div>
    </div>
  )
}
