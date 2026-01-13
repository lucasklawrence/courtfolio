import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Basketball.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const BasketballSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/BasketballSvg.svg#BasketballSvg" viewBox="0.00 0.00 1024.00 1024.00" />
}
