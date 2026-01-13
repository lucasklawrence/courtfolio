import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Zoe Sleeping.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const ZoeSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/ZoeSvg.svg#ZoeSvg" viewBox="0.00 0.00 1536.00 1024.00" />
}
