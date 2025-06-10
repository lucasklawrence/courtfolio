import { motion, useAnimation } from 'framer-motion';
import { useEffect } from 'react';

/**
 * Wraps any locker item with subtle swing animation on hover (desktop) or tap (mobile).
 *
 * @example
 * <InteractiveLockerItem>
 *   <DadJerseySVG className="w-14" />
 * </InteractiveLockerItem>
 */
export function InteractiveLockerItem({
  children,
}: {
  children: React.ReactNode
}) {
  const controls = useAnimation();

  const handleTap = () => {
    controls.start({
      rotate: [0, 1.5, -1.5, 0],
      transition: { duration: 1.5, ease: 'easeInOut' },
    });
  };

  return (
    <motion.div
      onTap={handleTap}
      whileHover={{
        rotate: [0, 1.5, -1.5, 0],
        transition: { duration: 1.5, ease: 'easeInOut' },
      }}
      animate={controls}
      className="cursor-pointer"
    >
      {children}
    </motion.div>
  );
}
