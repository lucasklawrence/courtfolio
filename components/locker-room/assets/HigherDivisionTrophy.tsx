import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Higher Division trophy.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const HigherDivisionTrophySVG: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/HigherDivisionTrophySVG.svg#HigherDivisionTrophySVG" viewBox="0.00 0.00 1024.00 1536.00" {...props} />
}
