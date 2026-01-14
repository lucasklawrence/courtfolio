import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Vinyl.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const VinylSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/VinylSvg.svg#VinylSvg" viewBox="0.00 0.00 1024.00 1024.00" {...props} />
}
