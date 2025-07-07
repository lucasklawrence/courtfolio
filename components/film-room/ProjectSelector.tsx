'use client'

import { motion } from 'framer-motion'
import { Project } from './data/project'
import { projects } from './data/filmRoomProjects'

type Props = {
  onSelect: (slug: string) => void
}

export const ProjectSelector: React.FC<Props> = ({ onSelect }) => {
  return (
    <motion.div
  className="w-full max-w-xl bg-neutral-800 border border-neutral-600 p-6 rounded-xl shadow-xl"
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  <h2 className="text-white text-2xl font-bold mb-4">🎞️ Choose a Project</h2>
  
  {/* Scrollable list container */}
  <div className="max-h-[440px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-600">
    <ul className="space-y-4">
      {projects.map((project: Project) => (
        <li key={project.slug}>
          <button
            className="w-full text-left bg-neutral-700 hover:bg-neutral-600 p-4 rounded transition group"
            onClick={() => onSelect(project.slug)}
          >
           {project.icon && (
  <img
    src={project.icon}
    alt={`${project.title} icon`}
    className="w-12 h-12 rounded shadow mb-3 object-contain"
  />
)}
            <h3 className="text-xl font-semibold text-white">{project.title}</h3>
            <p className="text-sm text-gray-300">{project.tagline}</p>
          </button>
        </li>
      ))}
    </ul>
  </div>
</motion.div>

  )
}
