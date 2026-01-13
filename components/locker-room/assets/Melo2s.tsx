import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for MB2s.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const Melo2sSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/Melo2sSvg.svg#Melo2sSvg" viewBox="0.00 0.00 1024.00 1024.00" />
}
