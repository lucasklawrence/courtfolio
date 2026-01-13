import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Mythical 5 trophy.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */
export const LosAngelesPictureSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return (
    <SvgUse
      href="/contact/LosAngelesPictureSvg.svg#LosAngelesPictureSvg"
      viewBox="0 0 1536 1024"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      {...props}
    />
  )
}
