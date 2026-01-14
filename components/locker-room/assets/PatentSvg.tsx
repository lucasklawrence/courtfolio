import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Patent.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const PatentSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/PatentSvg.svg#PatentSvg" viewBox="0.00 0.00 689.00 832.00" {...props} />
}
