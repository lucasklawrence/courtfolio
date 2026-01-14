import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for set of jerseys.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const JerseysSVG: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/JerseysSVG.svg#JerseysSVG" viewBox="0.00 0.00 1024.00 1024.00" {...props} />
}
