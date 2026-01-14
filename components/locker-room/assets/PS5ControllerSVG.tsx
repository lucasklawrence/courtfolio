import React from 'react'

import { SvgUse } from '@/components/common/SvgUse'

/**
 * SVG component for PS5 controller.
 * Can be scaled or positioned freely using Tailwind or inline styles.
 */

export const PS5ControllerSVG: React.FC<React.SVGProps<SVGSVGElement>> = props => {
  return <SvgUse href="/locker-room/PS5ControllerSVG.svg#PS5ControllerSVG" viewBox="0.00 0.00 1024.00 1024.00" {...props} />
}
