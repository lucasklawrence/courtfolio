import { motion } from 'framer-motion'

// components/LegacyRibbon.tsx
export const LegacyRibbon = () => (
  <motion.div
    initial={{ opacity: 0.9, y: 0 }}
    animate={{ opacity: 1, y: [0, 1, 0] }}
    transition={{ repeat: Infinity, duration: 3 }}
    className="absolute top-0 left-0 z-50"
  >
    <div className="bg-orange-700 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-br-md shadow-sm tracking-wide">
      Legacy
    </div>
  </motion.div>
)
