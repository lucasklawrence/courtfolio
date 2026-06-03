import { m } from 'framer-motion'

/**
 * Small "Legacy" ribbon pinned to the top-left corner of a project card to mark
 * an archived/older project. Bobs gently up and down on an infinite loop.
 *
 * Positioned `absolute`, so it must render inside a `relative` container (the
 * card it badges).
 */
export const LegacyRibbon = () => (
  <m.div
    initial={{ opacity: 0.9, y: 0 }}
    animate={{ opacity: 1, y: [0, 1, 0] }}
    transition={{ repeat: Infinity, duration: 3 }}
    className="absolute top-0 left-0 z-50"
  >
    <div className="bg-orange-700 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-br-md shadow-sm tracking-wide">
      Legacy
    </div>
  </m.div>
)
