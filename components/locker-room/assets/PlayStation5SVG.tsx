import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for PS5.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const PlayStation5SVG: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/PlayStation5SVG.svg#PlayStation5SVG" viewBox="0.00 0.00 1024.00 1024.00" />
}
