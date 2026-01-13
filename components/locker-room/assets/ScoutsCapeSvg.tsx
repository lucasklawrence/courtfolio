import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for Scouts Cape.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const ScoutsCapeSvg: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/ScoutsCapeSvg.svg#ScoutsCapeSvg" viewBox="0.00 0.00 1024.00 1024.00" />
}
