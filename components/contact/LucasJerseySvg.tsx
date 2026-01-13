import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Mythical 5 trophy.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */
export const LucasJerseySvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return (
    <SvgUse
      href="/contact/LucasJerseySvg.svg#LucasJerseySvg"
      viewBox="0 0 1024 1536"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    />
  )
}
