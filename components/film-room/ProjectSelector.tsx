'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { Project } from './data/project'
import { projects } from './data/filmRoomProjects'

export const ProjectSelector = ({ onSelect }: { onSelect: (slug: string) => void }) => {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="bg-neutral-900 border border-neutral-700 p-6 rounded-xl shadow-xl max-w-xl w-full">
        <h2 className="text-white text-2xl font-bold mb-4">🎞️ Choose a Project</h2>
        <ul className="space-y-4">
          {projects.map((project: Project) => (
            <li key={project.slug}>
              <button
                className="w-full text-left text-white bg-neutral-800 hover:bg-neutral-700 p-4 rounded transition"
                onClick={() => onSelect(project.slug)}
              >
                <h3 className="text-xl font-semibold">{project.title}</h3>
                <p className="text-sm text-gray-400">{project.tagline}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}
