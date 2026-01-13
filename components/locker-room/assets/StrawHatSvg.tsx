import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for one piece straw hat.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const StrawHatSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/StrawHatSvg.svg#StrawHatSvg" viewBox="0.00 0.00 1024.00 1024.00" />
}
