import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Kobes.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const KobesSVG: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/KobesSVG.svg#KobesSVG" viewBox="0.00 0.00 1024.00 1024.00" />
}
